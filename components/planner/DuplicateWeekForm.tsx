"use client";

import { duplicateWeekAction } from "@/lib/actions";
import { ActionSubmit } from "@/components/ui/ActionSubmit";
import { btnSecondary, fieldClass } from "@/lib/ui";

export function DuplicateWeekForm({
  sourceWeekId,
  sourceCount,
  defaultDestWeekId,
  options,
}: {
  sourceWeekId: string;
  sourceCount: number;
  defaultDestWeekId: string;
  options: Array<{ id: string; label: string; existing: number }>;
}) {
  return (
    <form
      action={duplicateWeekAction}
      className="ui-panel mt-3 p-3 sm:px-4"
      onSubmit={(event) => {
        const select = event.currentTarget.elements.namedItem(
          "destWeekId",
        ) as HTMLSelectElement | null;
        const dest = select?.value ?? "";
        const option = options.find((o) => o.id === dest);
        const extra =
          option && option.existing > 0
            ? ` ${option.label} already has ${option.existing} session(s). Copies will be added alongside them.`
            : "";
        if (
          !confirm(
            `Copy ${sourceCount} session(s) to ${option?.label ?? dest}?${extra}`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sourceWeekId" value={sourceWeekId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Duplicate week onto
          <select
            name="destWeekId"
            className={fieldClass}
            defaultValue={defaultDestWeekId}
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
                {opt.existing ? ` (${opt.existing} existing)` : ""}
              </option>
            ))}
          </select>
        </label>
        <ActionSubmit
          label="Duplicate week"
          busy="Copying week…"
          className={btnSecondary}
          disabled={sourceCount === 0}
        />
        <p className="text-xs text-stone-500">
          Copies each session with its own copy of the workout.
        </p>
      </div>
    </form>
  );
}
