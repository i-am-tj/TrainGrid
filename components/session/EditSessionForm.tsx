"use client";

import { useState } from "react";
import Link from "next/link";
import type { ScheduledSessionRecord } from "@/lib/data/model";
import { SESSION_TYPES, SESSION_TYPE_LABELS } from "@/lib/domain";
import {
  deleteScheduledSessionAction,
  updateScheduledSession,
} from "@/lib/actions";
import { datesOfWeek, formatLongDay, isValidWeekId, TIME_OPTIONS } from "@/lib/week";
import { btnDanger, btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

export function EditSessionForm({ session }: { session: ScheduledSessionRecord }) {
  const [weekId, setWeekId] = useState(session.weekId);
  const [untimed, setUntimed] = useState(session.startTime === null);
  const dates = isValidWeekId(weekId) ? datesOfWeek(weekId) : datesOfWeek(session.weekId);

  return (
    <div className="space-y-6">
      <form action={updateScheduledSession} className="space-y-4">
        <input type="hidden" name="id" value={session.id} />

        <label className="block text-sm font-medium">
          Week (YYYY-Www)
          <input
            name="weekId"
            className={fieldClass}
            value={weekId}
            onChange={(e) => setWeekId(e.target.value)}
          />
        </label>

        <label className="block text-sm font-medium">
          Day
          <select name="day" className={fieldClass} defaultValue={session.day}>
            {dates.map((date, i) => (
              <option key={i} value={i + 1}>
                {formatLongDay(date)}
              </option>
            ))}
          </select>
        </label>

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
            <input type="hidden" name="untimed" value={untimed ? "true" : "false"} />
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
          <button type="submit" className={btnPrimary}>
            Save
          </button>
          <Link href={`/session/${session.id}`} className={btnSecondary}>
            Cancel
          </Link>
        </div>
      </form>

      <form
        action={deleteScheduledSessionAction}
        onSubmit={(e) => {
          if (!confirm("Remove this session from the week? Its routine is kept.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={session.id} />
        <input type="hidden" name="weekId" value={session.weekId} />
        <input type="hidden" name="day" value={session.day} />
        <button type="submit" className={btnDanger}>
          Delete
        </button>
      </form>
    </div>
  );
}
