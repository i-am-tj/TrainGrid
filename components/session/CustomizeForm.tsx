"use client";

import Link from "next/link";
import { ActionSubmit } from "@/components/ui/ActionSubmit";
import { WorkoutItemEditor } from "@/components/library/WorkoutItemEditor";
import { customizeScheduledSession } from "@/lib/actions";
import type { PlannedItem } from "@/lib/data/model";
import { btnPrimary, btnSecondary } from "@/lib/ui";

export function CustomizeForm({
  id,
  items,
}: {
  id: string;
  items: PlannedItem[];
}) {
  return (
    <form
      action={customizeScheduledSession}
      className="ui-panel space-y-5 p-4 sm:p-6"
    >
      <input type="hidden" name="id" value={id} />
      <WorkoutItemEditor initial={items} />
      <div className="flex gap-2">
        <ActionSubmit label="Save" busy="Saving…" className={btnPrimary} />
        <Link href={`/session/${id}`} className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
