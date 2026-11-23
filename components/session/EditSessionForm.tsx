"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionSubmit } from "@/components/ui/ActionSubmit";
import type { ScheduledSessionRecord } from "@/lib/data/model";
import { SESSION_TYPES, SESSION_TYPE_LABELS } from "@/lib/domain";
import { updateScheduledSession } from "@/lib/actions";
import type { SessionDeletion } from "@/lib/workouts/deletion";
import { TIME_OPTIONS } from "@/lib/week";
import { DateField } from "./DateField";
import { DeleteSessionButton } from "./DeleteSessionButton";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

export function EditSessionForm({
  session,
  deletion,
  today,
}: {
  session: ScheduledSessionRecord;
  deletion: SessionDeletion;
  /** The member's today, "YYYY-MM-DD". */
  today: string;
}) {
  const [untimed, setUntimed] = useState(session.startTime === null);

  return (
    <div className="space-y-6">
      <form
        action={updateScheduledSession}
        className="ui-panel space-y-5 p-4 sm:p-6"
      >
        <input type="hidden" name="id" value={session.id} />

        <DateField defaultValue={session.date} today={today} />

        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium">
            Time
            <select
              name="time"
              className={fieldClass}
              defaultValue={session.startTime ?? "07:00"}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="hidden"
              name="untimed"
              value={untimed ? "true" : "false"}
            />
            <input
              type="checkbox"
              checked={untimed}
              onChange={(e) => setUntimed(e.target.checked)}
            />
            No start time
          </label>
        </div>

        <label className="block text-sm font-medium">
          Duration (minutes, optional)
          <input
            name="durationMinutes"
            type="number"
            min={1}
            max={1440}
            className={fieldClass}
            defaultValue={session.durationMinutes ?? ""}
          />
        </label>

        <label className="block text-sm font-medium">
          Name
          <input
            name="name"
            required
            maxLength={200}
            className={fieldClass}
            defaultValue={session.name}
          />
        </label>

        <label className="block text-sm font-medium">
          Type
          <select
            name="type"
            className={fieldClass}
            defaultValue={session.category}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SESSION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Notes
          <textarea
            name="notes"
            className={`${fieldClass} min-h-16`}
            defaultValue={session.notes}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <ActionSubmit label="Save" busy="Saving…" className={btnPrimary} />
          <Link href={`/session/${session.id}`} className={btnSecondary}>
            Cancel
          </Link>
        </div>
      </form>

      <DeleteSessionButton session={session} deletion={deletion} />
    </div>
  );
}
