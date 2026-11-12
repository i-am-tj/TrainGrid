"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WorkoutItemEditor } from "@/components/library/WorkoutItemEditor";
import { createScheduledSession } from "@/lib/actions";
import type { RoutineSummary } from "@/lib/data/model";
import type { IsoDay, SessionType } from "@/lib/domain";
import { SESSION_TYPES, SESSION_TYPE_LABELS } from "@/lib/domain";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";
import { datesOfWeek, formatLongDay, TIME_OPTIONS } from "@/lib/week";

export function AddSessionForm({
  weekId,
  routines,
  initialDay,
  initialTime,
  initialRoutineId,
}: {
  weekId: string;
  routines: RoutineSummary[];
  initialDay: IsoDay;
  initialTime: string | null;
  initialRoutineId: string | null;
}) {
  const dates = datesOfWeek(weekId);
  const [from, setFrom] = useState<"routine" | "blank">(
    initialRoutineId || routines.length ? "routine" : "blank",
  );
  const [routineId, setRoutineId] = useState(initialRoutineId ?? routines[0]?.id ?? "");
  const selected = useMemo(
    () => routines.find((r) => r.id === routineId) ?? null,
    [routines, routineId],
  );
  const [name, setName] = useState(selected?.name ?? "");
  const [type, setType] = useState<SessionType>(selected?.category ?? "other");
  const [untimed, setUntimed] = useState(initialTime === null);

  const shared = routines.filter((r) => r.scope === "GLOBAL");
  const mine = routines.filter((r) => r.isOwn);

  return (
    <form action={createScheduledSession} className="space-y-4">
      <input type="hidden" name="weekId" value={weekId} />
      <input type="hidden" name="from" value={from} />
      {from === "routine" ? <input type="hidden" name="routineId" value={routineId} /> : null}

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
          <select name="time" className={fieldClass} defaultValue={initialTime ?? "07:00"}>
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="hidden" name="untimed" value={untimed ? "true" : "false"} />
          <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} />
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
          placeholder="e.g. 60"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">From</legend>
        <label className="mr-4 text-sm">
          <input
            type="radio"
            name="fromChoice"
            checked={from === "routine"}
            onChange={() => {
              setFrom("routine");
              if (selected) {
                setName(selected.name);
                setType(selected.category);
              }
            }}
            disabled={routines.length === 0}
          />{" "}
          Routine
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

      {from === "routine" ? (
        <label className="block text-sm font-medium">
          Routine
          <select
            className={fieldClass}
            value={routineId}
            onChange={(e) => {
              const next = routines.find((r) => r.id === e.target.value);
              setRoutineId(e.target.value);
              if (next) {
                setName(next.name);
                setType(next.category);
              }
            }}
          >
            {mine.length > 0 ? (
              <optgroup label="My routines">
                {mine.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="TrainGrid library">
              {shared.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </optgroup>
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

      {from === "blank" ? (
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
      ) : null}

      <label className="block text-sm font-medium">
        Notes
        <textarea name="notes" maxLength={4000} className={`${fieldClass} min-h-16`} />
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
