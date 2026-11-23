import Link from "next/link";
import {
  formatDurationWords,
  formatPerformance,
  formatVolume,
  summarize,
  type PlannedExercise,
  type WeightUnit,
  type WorkoutEntries,
} from "@/lib/workouts/model";
import type { WorkoutSessionInfo } from "./WorkoutPlayer";

const secondaryAction =
  "ui-control inline-flex h-12 min-w-0 items-center justify-center rounded-2xl border border-stone-300 px-3 text-base font-medium text-stone-800 hover:bg-stone-100";

/** The end of a workout: a moment of satisfaction, then what was done. */
export function WorkoutSummaryView({
  session,
  plans,
  entries,
  unit,
  notes,
  startedAt,
  finishedAt,
  onEdit,
  postHref,
}: {
  session: WorkoutSessionInfo;
  plans: PlannedExercise[];
  entries: WorkoutEntries;
  unit: WeightUnit;
  notes: string;
  startedAt: string | null;
  finishedAt: string | null;
  onEdit: () => void;
  /** Where "Post about it" goes: the composer for this session. */
  postHref: string;
}) {
  const summary = summarize(entries);
  const seconds = startedAt && finishedAt ? (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000 : null;
  const stats = [
    seconds !== null ? { label: "Time", value: formatDurationWords(seconds) } : null,
    { label: "Sets", value: `${summary.setsDone}`, detail: summary.setsDone < summary.setsTotal ? `of ${summary.setsTotal}` : undefined },
    summary.volume > 0
      ? { label: "Volume", value: formatVolume(summary.volume), detail: unit }
      : summary.repsDone > 0
        ? { label: "Reps", value: `${summary.repsDone}` }
        : null,
    { label: "Exercises", value: `${summary.exercisesDone}`, detail: `of ${summary.exercisesTotal}` },
  ].filter((stat): stat is { label: string; value: string; detail?: string } => stat !== null);

  return (
    <div className="workout-screen min-h-dvh">
      <div className="mx-auto max-w-lg px-4 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <div className="workout-celebrate text-center">
          <span className="workout-trophy mx-auto grid size-20 place-items-center rounded-full">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-check-draw size-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <p className="ui-eyebrow mt-6">Workout complete</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{session.name}</h1>
          <p className="mt-1 text-sm text-stone-600">{session.dateLabel}</p>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="ui-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-[0.14em] text-stone-600">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {stat.value}
                {stat.detail ? <span className="ml-1 text-sm font-normal text-stone-600">{stat.detail}</span> : null}
              </dd>
            </div>
          ))}
        </dl>

        <ul className="ui-panel mt-5 divide-y divide-line overflow-hidden">
          {entries.items.map((item, index) => {
            const done = item.sets.filter((set) => set.done);
            const plan = plans[index];
            const text =
              done.length === 0
                ? "Skipped"
                : plan?.mode === "done"
                  ? `${done.length} of ${item.sets.length} done`
                  : formatPerformance({ unit, sets: done });
            return (
              <li key={item.item_id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{plan?.name ?? item.name}</span>
                <span className={`shrink-0 text-right text-sm tabular-nums ${done.length ? "text-stone-700" : "text-stone-500"}`}>{text}</span>
              </li>
            );
          })}
        </ul>

        {notes ? (
          <p className="mt-5 whitespace-pre-line rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-700">{notes}</p>
        ) : null}
      </div>

      {/* Done is the finish (PRODUCT_AUDIT F16): the full-width primary action,
          nearest the thumb. Posting stays one tap away, beside Edit sets. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-md">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button type="button" onClick={onEdit} className={secondaryAction}>
            Edit sets
          </button>
          <Link href={postHref} data-testid="post-about-it" className={secondaryAction}>
            Post about it
          </Link>
          <Link
            href="/home"
            className="workout-log-button ui-control col-span-2 inline-flex h-14 items-center justify-center rounded-2xl text-base font-semibold"
          >
            Done
          </Link>
        </div>
      </div>
    </div>
  );
}
