import { notFound, redirect } from "next/navigation";
import { AddSessionForm } from "@/components/session/AddSessionForm";
import { dateOfWeekDay, isRealWeekId } from "@/lib/calendar-date";
import { dateProblem } from "@/lib/session-date";
import { findGlobalRoutineIdBySlug, listRoutines } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import { getRequestToday } from "@/lib/today";
import type { IsoDay } from "@/lib/domain";
import { isValidTime } from "@/lib/week";
import { pageMetadata } from "@/lib/page-metadata";

/** "Schedule routine" when opened from a routine's Schedule link. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ routine?: string; template?: string }>;
}) {
  const query = await searchParams;
  return pageMetadata(query.routine || query.template ? "Schedule routine" : "Add session");
}

export default async function AddSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{
    day?: string;
    date?: string;
    time?: string;
    routine?: string;
    template?: string;
    untimed?: string;
  }>;
}) {
  const { db, userId } = await memberData();
  const { weekId: rawWeekId } = await params;
  const query = await searchParams;
  const today = await getRequestToday();

  if (rawWeekId === "current") {
    const q = new URLSearchParams();
    for (const key of ["day", "date", "time", "routine", "template", "untimed"] as const) {
      const value = query[key];
      if (value) q.set(key, value);
    }
    const suffix = q.toString() ? `?${q}` : "";
    redirect(`/week/${today.weekId}/add${suffix}`);
  }
  if (!isRealWeekId(rawWeekId)) notFound();

  const routines = await listRoutines(db, userId);
  const dayNum = Number(query.day);
  const day: IsoDay =
    dayNum >= 1 && dayNum <= 7
      ? (dayNum as IsoDay)
      : rawWeekId === today.weekId
        ? today.day
        : 1;
  // ?date= picks the day directly (any week); otherwise ?day= within this week.
  const initialDate =
    query.date && !dateProblem(query.date) ? query.date : dateOfWeekDay(rawWeekId, day);
  const time = query.time && isValidTime(query.time) ? query.time : null;
  const untimed = query.untimed === "1" || query.untimed === "true";
  // ?template=<slug> is the legacy Schedule link; it names a seeded GLOBAL routine.
  const requested =
    query.routine ?? (query.template ? await findGlobalRoutineIdBySlug(db, query.template) : null);
  const initialRoutineId = routines.some((r) => r.id === requested) ? requested! : null;

  return (
    <div className="workout-body mx-auto max-w-2xl px-3 py-7 sm:px-4 sm:py-10">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        {initialRoutineId ? "Schedule routine" : "Add session"}
      </h1>
      <p className="mt-2 text-sm leading-7 text-stone-600">
        {initialRoutineId
          ? "Choose the day and time. The routine is copied into the session, so later changes to the routine do not affect it."
          : "Put a routine or a one-off session on any day. A routine is copied into the session, so later changes to the routine do not affect it."}
      </p>
      <div className="mt-6">
        <AddSessionForm
          weekId={rawWeekId}
          routines={routines}
          initialDate={initialDate}
          today={today.date}
          initialTime={untimed ? null : (time ?? "07:00")}
          initialRoutineId={initialRoutineId}
        />
      </div>
    </div>
  );
}
