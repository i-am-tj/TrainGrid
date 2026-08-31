"use client";

import { useMemo, useState } from "react";
import type { IsoDay, SessionTemplate, SessionType } from "@/lib/domain";
import { SESSION_TYPES, SESSION_TYPE_LABELS } from "@/lib/domain";
import { createScheduledSession } from "@/lib/actions";
import { datesOfWeek, formatLongDay, TIME_OPTIONS } from "@/lib/week";
import { WorkoutItemEditor } from "@/components/library/WorkoutItemEditor";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";
import Link from "next/link";

export function AddSessionForm({
  weekId,
  templates,
  initialDay,
  initialTime,
  initialTemplateId,
}: {
  weekId: string;
  templates: SessionTemplate[];
  initialDay: IsoDay;
  initialTime: string | null;
  initialTemplateId: string | null;
}) {
  const dates = datesOfWeek(weekId);
  const [from, setFrom] = useState<"template" | "blank">(
    initialTemplateId || templates.length ? "template" : "blank",
  );
  const [templateId, setTemplateId] = useState(
    initialTemplateId ?? templates[0]?.id ?? "",
  );
  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );
  const [name, setName] = useState(selected?.name ?? "");
  const [type, setType] = useState<SessionType>(selected?.type ?? "other");
  const [untimed, setUntimed] = useState(initialTime === null);

  return (
    <form action={createScheduledSession} className="space-y-4">
      <input type="hidden" name="weekId" value={weekId} />
      <input type="hidden" name="from" value={from} />
      {from === "template" ? (
        <input type="hidden" name="templateId" value={templateId} />
      ) : null}

      <label className="block text-sm font-medium">
        Day
        <select name="day" className={fieldClass} defaultValue={initialDay}>
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
            defaultValue={initialTime ?? "07:00"}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
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
          className={fieldClass}
          placeholder="e.g. 60"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">From</legend>
        <label className="mr-4 text-sm">
          <input
            type="radio"
            name="fromChoice"
            checked={from === "template"}
            onChange={() => {
              setFrom("template");
              if (selected) {
                setName(selected.name);
                setType(selected.type);
              }
            }}
            disabled={templates.length === 0}
          />{" "}
          Template
        </label>
        <label className="text-sm">
          <input
            type="radio"
            name="fromChoice"
            checked={from === "blank"}
            onChange={() => setFrom("blank")}
          />{" "}
          Blank
        </label>
      </fieldset>

      {from === "template" ? (
        <label className="block text-sm font-medium">
          Template
          <select
            className={fieldClass}
            value={templateId}
            onChange={(e) => {
              const next = templates.find((t) => t.id === e.target.value);
              setTemplateId(e.target.value);
              if (next) {
                setName(next.name);
                setType(next.type);
              }
            }}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block text-sm font-medium">
        Name
        <input
          name="name"
          required
          maxLength={200}
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="block text-sm font-medium">
        Type
        <select
          name="type"
          className={fieldClass}
          value={type}
          onChange={(e) => setType(e.target.value as SessionType)}
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
        <textarea name="notes" className={`${fieldClass} min-h-16`} />
      </label>

      {from === "blank" ? (
        <div>
          <h2 className="mb-2 text-sm font-medium">Workout items</h2>
          <WorkoutItemEditor initial={[]} />
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className={btnPrimary}>
          Add
        </button>
        <Link href={`/week/${weekId}`} className={btnSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
