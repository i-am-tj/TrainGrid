import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DayAgenda } from "@/components/planner/DayAgenda";
import { DuplicateWeekForm } from "@/components/planner/DuplicateWeekForm";
import { WeekGrid } from "@/components/planner/WeekGrid";
import { WeekNav } from "@/components/planner/WeekNav";
import type { IsoDay } from "@/lib/domain";
import { listSessions } from "@/lib/schedule";
import { listTemplates } from "@/lib/templates";
import { resolveSessions } from "@/lib/resolve-session";
import { addWeeks, formatWeekLabel, isValidWeekId, nearbyWeekIds, todayParts } from "@/lib/week";

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { weekId: rawWeekId } = await params;
  const query = await searchParams;
  const today = todayParts();

  if (rawWeekId === "current") {
    redirect(`/week/${today.weekId}?day=${query.day ?? today.day}`);
  }
  if (!isValidWeekId(rawWeekId)) notFound();

  const templates = await listTemplates();
  const allSessions = await listSessions();
  const weekSessions = resolveSessions(
    allSessions.filter((s) => s.weekId === rawWeekId),
    templates,
  );

  const requestedDay = Number(query.day);
  const day: IsoDay =
    requestedDay >= 1 && requestedDay <= 7
      ? (requestedDay as IsoDay)
      : rawWeekId === today.weekId
        ? today.day
        : 1;

  const occupiedWeeks: Record<string, number> = {};
  for (const session of allSessions) {
    occupiedWeeks[session.weekId] = (occupiedWeeks[session.weekId] ?? 0) + 1;
  }
  const duplicateOptions = nearbyWeekIds(rawWeekId)
    .filter((id) => id !== rawWeekId)
    .map((id) => ({
      id,
      label: formatWeekLabel(id),
      existing: occupiedWeeks[id] ?? 0,
    }));

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <WeekNav
        weekId={rawWeekId}
        todayWeekId={today.weekId}
        todayDay={today.day}
      />
      <DuplicateWeekForm
        sourceWeekId={rawWeekId}
        sourceCount={weekSessions.length}
        defaultDestWeekId={addWeeks(rawWeekId, 1)}
        options={duplicateOptions}
      />

      {weekSessions.length === 0 ? (
        <p className="mt-3 hidden text-sm text-stone-600 md:block">
          No sessions this week.{" "}
          <Link href={`/week/${rawWeekId}/add`} className="underline">
            Add session
          </Link>
        </p>
      ) : null}

      <div className="hidden md:block">
        <WeekGrid weekId={rawWeekId} sessions={weekSessions} />
      </div>
      <DayAgenda weekId={rawWeekId} day={day} sessions={weekSessions} />
    </div>
  );
}
