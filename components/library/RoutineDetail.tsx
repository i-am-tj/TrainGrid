import Link from "next/link";
import { WorkoutItemsView } from "@/components/session/WorkoutItemsView";
import type { Routine } from "@/lib/data/model";
import { SESSION_TYPE_LABELS } from "@/lib/domain";
import { equipmentUsed, routineAtAGlance } from "@/lib/library/summary";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { SourceLabel } from "./SourceLabel";

/**
 * One routine, read in full before scheduling (E2-03). GLOBAL routines are
 * read-only: there is no Edit control, and the edit URL does not open an
 * editor. Schedule is the primary action (E2-05).
 */
export function RoutineDetail({ routine }: { routine: Routine }) {
  return (
    <div>
      <Link href="/library" className="text-sm text-stone-600 hover:underline">
        ← Back to Library
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-y-1">
          <h1 className="text-xl font-semibold">{routine.name}</h1>
          <SourceLabel isOwn={routine.isOwn} />
        </div>
        <p className="mt-1 text-sm text-stone-600">
          {SESSION_TYPE_LABELS[routine.category]}
          {routine.description ? ` · ${routine.description}` : ""}
        </p>
        <p className="mt-1 text-sm text-stone-600">
          {routineAtAGlance(routine.items.length, equipmentUsed(routine.items))}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          {routine.isOwn ? "Your routine" : "TrainGrid library · read-only"}
        </p>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/week/current/add?routine=${routine.id}`}
          className={btnPrimary}
          aria-label={`Schedule ${routine.name}`}
        >
          Schedule
        </Link>
        {routine.isOwn ? (
          <Link
            href={`/library/${routine.id}/edit`}
            className={btnSecondary}
            aria-label="Edit routine"
          >
            Edit
          </Link>
        ) : null}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <WorkoutItemsView items={routine.items} />
      </div>
    </div>
  );
}
