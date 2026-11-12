"use client";

import Link from "next/link";
import { deleteRoutineAction, upsertRoutineAction } from "@/lib/actions";
import type { Routine } from "@/lib/data/model";
import { SESSION_TYPES, SESSION_TYPE_LABELS } from "@/lib/domain";
import { btnDanger, btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";
import { WorkoutItemEditor } from "./WorkoutItemEditor";

/** Creates or edits one of the member's own routines. */
export function RoutineEditor({ routine }: { routine: Routine | null }) {
  return (
    <div className="space-y-6">
      <form action={upsertRoutineAction} className="space-y-4">
        {routine ? <input type="hidden" name="id" value={routine.id} /> : null}

        <label className="block text-sm font-medium">
          Name
          <input
            name="name"
            required
            maxLength={200}
            className={fieldClass}
            defaultValue={routine?.name ?? ""}
          />
        </label>

        <label className="block text-sm font-medium">
          Type
          <select name="type" className={fieldClass} defaultValue={routine?.category ?? "strength"}>
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SESSION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Description
          <textarea
            name="description"
            maxLength={2000}
            className={`${fieldClass} min-h-16`}
            defaultValue={routine?.description ?? ""}
          />
        </label>

        <div>
          <h2 className="mb-2 text-sm font-medium">Workout items</h2>
          <WorkoutItemEditor initial={routine?.items ?? []} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary}>
            Save
          </button>
          {routine ? (
            <Link href={`/library/${routine.id}`} className={btnSecondary}>
              Cancel
            </Link>
          ) : null}
          <Link href="/library" className={btnSecondary}>
            Back to library
          </Link>
        </div>
      </form>

      {routine ? (
        <form
          action={deleteRoutineAction}
          onSubmit={(e) => {
            if (
              !confirm(
                "Delete this routine? Sessions already on your calendar keep their own copy of the workout.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={routine.id} />
          <button type="submit" className={btnDanger}>
            Delete routine
          </button>
        </form>
      ) : null}
    </div>
  );
}
