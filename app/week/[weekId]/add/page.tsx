import { notFound, redirect } from "next/navigation";
import { AddSessionForm } from "@/components/session/AddSessionForm";
import { isRealWeekId } from "@/lib/calendar-date";
import { findGlobalRoutineIdBySlug, listRoutines } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import type { IsoDay } from "@/lib/domain";
import { isValidTime, todayParts } from "@/lib/week";

export default async function AddSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{
    day?: string;
    time?: string;
    routine?: string;
    template?: string;
    untimed?: string;
  }>;
}) {
  const { db, userId } = await memberData();
  const { weekId: rawWeekId } = await params;
  const query = await searchParams;
  const today = todayParts();

  if (rawWeekId === "current") {
    const q = new URLSearchParams();
    for (const key of ["day", "time", "routine", "template", "untimed"] as const) {
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
  const time = query.time && isValidTime(query.time) ? query.time : null;
  const untimed = query.untimed === "1" || query.untimed === "true";
  // ?template=<slug> is the legacy Schedule link; it names a seeded GLOBAL routine.
  const requested =
    query.routine ?? (query.template ? await findGlobalRoutineIdBySlug(db, query.template) : null);
  const initialRoutineId = routines.some((r) => r.id === requested) ? requested! : null;

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Add session</h1>
      <p className="mt-1 text-sm text-stone-600">
        Put a routine or a one-off session on this week. A routine is copied into the session, so
        later changes to the routine do not affect it.
      </p>
      <div className="mt-6">
        <AddSessionForm
          weekId={rawWeekId}
          routines={routines}
          initialDay={day}
          initialTime={untimed ? null : (time ?? "07:00")}
          initialRoutineId={initialRoutineId}
        />
      </div>
    </div>
  );
}
