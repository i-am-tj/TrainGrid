"use client";

import Link from "next/link";
import { WorkoutItemEditor } from "@/components/library/WorkoutItemEditor";
import { customizeScheduledSession } from "@/lib/actions";
import type { PlannedItem } from "@/lib/data/model";
import { btnPrimary, btnSecondary } from "@/lib/ui";

export function CustomizeForm({ id, items }: { id: string; items: PlannedItem[] }) {
  return (
    <form action={customizeScheduledSession} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <WorkoutItemEditor initial={items} />
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>
          Save
        </button>
        <Link href={`/session/${id}`} className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
