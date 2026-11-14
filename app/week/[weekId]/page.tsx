import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SectionLoader } from "@/components/LogoLoader";
import { DayAgenda } from "@/components/planner/DayAgenda";
import { DuplicateWeekForm } from "@/components/planner/DuplicateWeekForm";
import { WeekGrid } from "@/components/planner/WeekGrid";
import { WeekNav } from "@/components/planner/WeekNav";
import { isRealWeekId } from "@/lib/calendar-date";
import type { Db } from "@/lib/data/model";
import { toPlannerSession } from "@/lib/data/planner";
import { memberData } from "@/lib/data/server";
import { countSessionsByWeek, listSessionsForWeek } from "@/lib/data/sessions";
import type { IsoDay } from "@/lib/domain";
import { addWeeks, formatWeekLabel, nearbyWeekIds, todayParts } from "@/lib/week";

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { db, userId } = await memberData();
  const { weekId: rawWeekId } = await params;
  const query = await searchParams;
  const today = todayParts();

  if (rawWeekId === "current") {
    redirect(`/week/${today.weekId}?day=${query.day ?? today.day}`);
  }
  if (!isRealWeekId(rawWeekId)) notFound();

  const requestedDay = Number(query.day);
  const day: IsoDay =
    requestedDay >= 1 && requestedDay <= 7
      ? (requestedDay as IsoDay)
      : rawWeekId === today.weekId
        ? today.day
        : 1;

  // Everything that can 404 or redirect has run; the week's data streams in
  // behind the section loader while the navigation is already on screen.
  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <WeekNav weekId={rawWeekId} todayWeekId={today.weekId} todayDay={today.day} />
      <Suspense key={`${rawWeekId}-${day}`} fallback={<SectionLoader label="Loading your week…" minHeight="min-h-96" />}>
        <WeekContent db={db} userId={userId} weekId={rawWeekId} day={day} />
      </Suspense>
    </div>
  );
}

async function WeekContent({ db, userId, weekId, day }: { db: Db; userId: string; weekId: string; day: IsoDay }) {
  const nearby = nearbyWeekIds(weekId).filter((id) => id !== weekId);
  const [records, occupied] = await Promise.all([
    listSessionsForWeek(db, userId, weekId),
    countSessionsByWeek(db, userId, nearby),
  ]);
  const weekSessions = records.map(toPlannerSession);

  const duplicateOptions = nearby.map((id) => ({
    id,
    label: formatWeekLabel(id),
    existing: occupied[id] ?? 0,
  }));

  return (
    <>
      <DuplicateWeekForm
        sourceWeekId={weekId}
        sourceCount={weekSessions.length}
        defaultDestWeekId={addWeeks(weekId, 1)}
        options={duplicateOptions}
      />

      {weekSessions.length === 0 ? (
        <p className="mt-3 hidden text-sm text-stone-600 md:block">
          No sessions this week.{" "}
          <Link href={`/week/${weekId}/add`} className="underline">
            Add session
          </Link>
        </p>
      ) : null}

      <div className="hidden md:block">
        <WeekGrid weekId={weekId} sessions={weekSessions} />
      </div>
      <DayAgenda weekId={weekId} day={day} sessions={weekSessions} />
    </>
  );
}
