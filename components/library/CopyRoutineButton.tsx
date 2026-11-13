"use client";

import { useFormStatus } from "react-dom";
import { copyRoutineAction } from "@/lib/actions";
import { btnSecondary } from "@/lib/ui";

function Submit({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? `Copying ${name}` : `Copy ${name} to My Library`}
      className={`${btnSecondary} disabled:opacity-60`}
    >
      {pending ? "Copying…" : "Copy to My Library"}
    </button>
  );
}

/**
 * Makes the member's own editable copy of a TrainGrid routine (E2-04). The
 * button is disabled while the copy is saving, so a double click cannot make
 * two copies by accident; copying again later is allowed and makes another.
 */
export function CopyRoutineButton({ routineId, name }: { routineId: string; name: string }) {
  return (
    <form action={copyRoutineAction}>
      <input type="hidden" name="routineId" value={routineId} />
      <Submit name={name} />
    </form>
  );
}
