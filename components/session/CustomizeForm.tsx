"use client";

import { customizeScheduledSession } from "@/lib/actions";
import { WorkoutItemEditor } from "@/components/library/WorkoutItemEditor";
import { parseWorkoutItems } from "@/lib/workout-items";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import Link from "next/link";

export function CustomizeForm({
  id,
  body,
}: {
  id: string;
  body: string;
}) {
  return (
    <form action={customizeScheduledSession} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <WorkoutItemEditor initial={parseWorkoutItems(body)} />
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>
          Save copy
        </button>
        <Link href={`/session/${id}`} className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
