import Link from "next/link";
import { WorkoutItemsView } from "@/components/session/WorkoutItemsView";
import type { Routine } from "@/lib/data/model";
import { SESSION_TYPE_LABELS } from "@/lib/domain";
import { btnSecondary } from "@/lib/ui";

export function RoutineDetail({ routine }: { routine: Routine }) {
  return (
    <div>
      <Link href="/library" className="text-sm text-stone-600 hover:underline">
        ← Back to Library
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{routine.name}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {SESSION_TYPE_LABELS[routine.category]}
            {routine.description ? ` · ${routine.description}` : ""}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {routine.isOwn ? "Your routine" : "TrainGrid library · read-only"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/week/current/add?routine=${routine.id}`} className={btnSecondary}>
            Schedule
          </Link>
          {routine.isOwn ? (
            <Link
              href={`/library/${routine.id}/edit`}
              className={`${btnSecondary} gap-2 px-3`}
              aria-label="Edit routine"
            >
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <WorkoutItemsView items={routine.items} />
      </div>
    </div>
  );
}
