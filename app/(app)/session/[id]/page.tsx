import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkoutItemsView } from "@/components/session/WorkoutItemsView";
import { getRoutine } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import { getSession } from "@/lib/data/sessions";
import { getWorkoutLog } from "@/lib/data/workouts";
import { btnSecondary, TYPE_SHORT } from "@/lib/ui";
import { datesOfWeek, formatLongDay } from "@/lib/week";
import { formatDurationWords, formatVolume, summarize, type WorkoutLog } from "@/lib/workouts/model";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const session = await getSession(db, userId, id);
  if (!session) notFound();

  const [source, log] = await Promise.all([
    session.sourceRoutineId ? getRoutine(db, userId, session.sourceRoutineId) : null,
    getWorkoutLog(db, userId, session.id),
  ]);
  const date = datesOfWeek(session.weekId)[session.day - 1]!;

  return (
    <div className="workout-body mx-auto max-w-2xl px-3 pb-32 pt-7 sm:px-4 sm:py-10">
      <Link
        href={`/week/${session.weekId}?day=${session.day}`}
        className="text-sm text-stone-600 hover:underline"
      >
        ← Back to week
      </Link>

      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">{session.name}</h1>
      <p className="mt-2 text-sm leading-7 text-stone-600">
        {TYPE_SHORT[session.category]} · {formatLongDay(date)}
        {session.startTime ? ` · ${session.startTime}` : " · no specific time"}
        {session.durationMinutes != null ? ` · ${session.durationMinutes}m` : ""}
      </p>

      <WorkoutCallout sessionId={session.id} log={log} hasItems={session.items.length > 0} />

      <p className="mt-3 rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
        {source ? (
          <>
            Copied from{" "}
            <Link href={`/library/${source.id}`} className="underline">
              {source.name}
            </Link>
            . Changes to that routine do not affect this session.
          </>
        ) : (
          // Deleting a routine clears this link, so a one-off session and one
          // whose routine was deleted look the same here.
          "Not linked to a routine. This session has its own copy of the workout."
        )}
      </p>

      {session.notes ? (
        <p className="mt-4 whitespace-pre-line text-sm">
          <span className="font-medium">Notes:</span> {session.notes}
        </p>
      ) : null}

      <div className="mt-6 border-t border-line pt-4">
        <WorkoutItemsView items={session.items} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={`/session/${session.id}/edit`} className={btnSecondary}>
          Edit
        </Link>
        <Link href={`/session/${session.id}/customize`} className={btnSecondary}>
          Customize content
        </Link>
      </div>
    </div>
  );
}

/**
 * The way into the live workout. On phones the button sits in a bar at the
 * bottom of the screen, where the thumb is; on wider screens it sits inline.
 */
function WorkoutCallout({ sessionId, log, hasItems }: { sessionId: string; log: WorkoutLog | null; hasItems: boolean }) {
  const href = `/workout/${sessionId}`;
  if (log?.status === "completed") {
    const summary = summarize(log.entries);
    const seconds = log.finishedAt ? (Date.parse(log.finishedAt) - Date.parse(log.startedAt)) / 1000 : null;
    const facts = [
      seconds !== null ? formatDurationWords(seconds) : null,
      `${summary.setsDone} ${summary.setsDone === 1 ? "set" : "sets"}`,
      summary.volume > 0 ? `${formatVolume(summary.volume)} ${log.unit} lifted` : null,
    ].filter(Boolean);
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
        <span aria-hidden="true" className="workout-done-dot grid size-8 shrink-0 place-items-center rounded-full text-white">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Workout done</p>
          <p className="text-sm">{facts.join(" · ")}</p>
        </div>
        <Link href={href} className={`${btnSecondary} rounded-xl`}>
          View workout
        </Link>
      </div>
    );
  }

  if (!hasItems) return null;
  const inProgress = log?.status === "in_progress";
  const summary = inProgress ? summarize(log.entries) : null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {summary ? (
          <p className="min-w-0 flex-1 text-sm text-stone-700 sm:order-2 sm:flex-none">
            <span className="font-semibold text-stone-900">In progress</span> · {summary.setsDone} of {summary.setsTotal} sets
          </p>
        ) : null}
        <Link
          href={href}
          className={`workout-log-button ui-control inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-base font-semibold sm:h-12 ${summary ? "" : "flex-1 sm:flex-none"}`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
            <path d="M8 5.5v13l11-6.5-11-6.5z" />
          </svg>
          {inProgress ? "Resume workout" : "Start workout"}
        </Link>
      </div>
    </div>
  );
}
