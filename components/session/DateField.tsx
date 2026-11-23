"use client";

import { useId, useState } from "react";
import { DATE_MAX, DATE_MIN, dateProblem, dateShortcuts, describeDate } from "@/lib/session-date";
import { fieldClass } from "@/lib/ui";

/**
 * The one way to choose a session's day, when adding it and when moving it:
 * the device's own calendar, a line saying which day that is ("Monday 4
 * January 2027 · next week") and one-tap Today / Tomorrow / Next Monday.
 * Any week works, so a routine chosen in the Library can go straight onto
 * next Monday (PRODUCT_AUDIT F2). A problem is shown beside the field and the
 * form is not sent, so nothing typed elsewhere in the form is lost.
 */
export function DateField({
  defaultValue,
  today,
  name = "date",
  label = "Date",
}: {
  defaultValue: string;
  /** The member's today, "YYYY-MM-DD" (lib/today.ts), so "next week" means their week. */
  today: string;
  name?: string;
  label?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const description = describeDate(value, today);

  function choose(next: string) {
    setValue(next);
    setError(null);
  }

  return (
    <div>
      <label htmlFor={`${id}-input`} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={`${id}-input`}
        type="date"
        name={name}
        required
        min={DATE_MIN}
        max={DATE_MAX}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
        className={fieldClass}
        onChange={(event) => choose(event.target.value)}
        onInvalid={(event) => {
          // TrainGrid's own message beside the field instead of the browser's bubble.
          event.preventDefault();
          setError(dateProblem(event.currentTarget.value) ?? "Choose a date.");
          event.currentTarget.focus();
        }}
      />
      <p id={`${id}-description`} className="mt-1.5 text-sm text-stone-600" aria-live="polite" data-testid="date-description">
        {description ?? "No date chosen yet."}
      </p>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick dates">
        {dateShortcuts(today).map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            aria-pressed={value === shortcut.date}
            onClick={() => choose(shortcut.date)}
            className="ui-control inline-flex min-h-9 items-center rounded-full border border-stone-300 bg-white px-3 text-sm text-stone-800 hover:bg-stone-50 aria-pressed:border-stone-900 aria-pressed:bg-stone-900 aria-pressed:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  );
}
