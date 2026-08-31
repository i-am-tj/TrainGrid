"use client";

import Link from "next/link";
import { SESSION_TYPES, type SessionTemplate } from "@/lib/domain";
import { deleteTemplateAction, upsertTemplateAction } from "@/lib/actions";
import { parseWorkoutItems } from "@/lib/workout-items";
import { WorkoutItemEditor } from "./WorkoutItemEditor";
import { btnDanger, btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

export function TemplateEditor({
  template,
}: {
  template: SessionTemplate | null;
}) {
  const initial = template ? parseWorkoutItems(template.body) : [];

  return (
    <div className="space-y-6">
      <form action={upsertTemplateAction} className="space-y-4">
        {template ? <input type="hidden" name="id" value={template.id} /> : null}

        <label className="block text-sm font-medium">
          Name
          <input
            name="name"
            required
            maxLength={200}
            className={fieldClass}
            defaultValue={template?.name ?? ""}
          />
        </label>

        {template ? (
          <p className="text-xs text-stone-500">
            ID: <code>{template.id}</code> (immutable)
          </p>
        ) : (
          <p className="text-xs text-stone-500">
            ID is generated from the name when you save.
          </p>
        )}

        <label className="block text-sm font-medium">
          Type
          <select
            name="type"
            className={fieldClass}
            defaultValue={template?.type ?? "strength"}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Description / notes
          <textarea
            name="description"
            className={`${fieldClass} min-h-16`}
            defaultValue={template?.description ?? ""}
          />
        </label>

        <div>
          <h2 className="mb-2 text-sm font-medium">Workout items</h2>
          <WorkoutItemEditor initial={initial} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary}>
            Save
          </button>
          <Link href="/library" className={btnSecondary}>
            Back to library
          </Link>
        </div>
      </form>

      {template ? (
        <form
          action={deleteTemplateAction}
          onSubmit={(e) => {
            if (
              !confirm(
                "Delete this template? Scheduled sessions stay on the planner with a snapshot of the current workout text.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={template.id} />
          <button type="submit" className={btnDanger}>
            Delete template
          </button>
        </form>
      ) : null}
    </div>
  );
}
