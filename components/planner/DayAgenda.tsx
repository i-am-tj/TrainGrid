import Link from "next/link";
import type { IsoDay, ResolvedSession } from "@/lib/domain";
import { compareSessions } from "@/lib/domain";
import {
  addWeeks,
  datesOfWeek,
  formatDayNarrow,
  formatLongDay,
  sameLocalDay,
} from "@/lib/week";
import { SessionCard } from "./SessionCard";
import { btnSecondary } from "@/lib/ui";

export function WeekStrip({
  weekId,
  selectedDay,
}: {
  weekId: string;
  selectedDay: IsoDay;
}) {
  const dates = datesOfWeek(weekId);
  const now = new Date();

  return (
    <div className="mt-3 flex gap-1">
      {dates.map((date, i) => {
        const day = (i + 1) as IsoDay;
        const selected = day === selectedDay;
        const isToday = sameLocalDay(date, now);
        return (
          <Link
            key={day}
            href={`/week/${weekId}?day=${day}`}
            className={`flex-1 rounded-md py-2 text-center text-xs ${
              selected
                ? "bg-stone-900 text-white"
                : isToday
                  ? "bg-amber-100 text-stone-900"
                  : "bg-card text-stone-700"
            }`}
          >
            <div className="font-semibold">{formatDayNarrow(date)}</div>
            <div>{date.getDate()}</div>
          </Link>
        );
      })}
    </div>
  );
}

export function DayAgenda({
  weekId,
  day,
  sessions,
}: {
  weekId: string;
  day: IsoDay;
  sessions: ResolvedSession[];
}) {
  const dates = datesOfWeek(weekId);
  const date = dates[day - 1]!;
  const prev =
    day === 1
      ? { weekId: addWeeks(weekId, -1), day: 7 as IsoDay }
      : { weekId, day: ((day - 1) as IsoDay) };
  const next =
    day === 7
      ? { weekId: addWeeks(weekId, 1), day: 1 as IsoDay }
      : { weekId, day: ((day + 1) as IsoDay) };

  const untimed = sessions
    .filter((s) => s.day === day && s.time === null)
    .sort(compareSessions);
  const timed = sessions
    .filter((s) => s.day === day && s.time !== null)
    .sort(compareSessions);

  return (
    <div className="mt-3 md:hidden">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/week/${prev.weekId}?day=${prev.day}`}
          className={btnSecondary}
          aria-label="Previous day"
        >
          ←
        </Link>
        <h2 className="text-base font-semibold">{formatLongDay(date)}</h2>
        <Link
          href={`/week/${next.weekId}?day=${next.day}`}
          className={btnSecondary}
          aria-label="Next day"
        >
          →
        </Link>
      </div>
      <WeekStrip weekId={weekId} selectedDay={day} />

      <div className="mt-4 space-y-3">
        {untimed.length > 0 ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Untimed
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              {untimed.map((s) => (
                <SessionCard key={s.id} session={s} showTime />
              ))}
            </div>
          </section>
        ) : null}

        {timed.length > 0 ? (
          <section className="space-y-2">
            {timed.map((s) => (
              <div key={s.id} className="flex gap-3">
                <div className="w-12 shrink-0 pt-1 text-xs text-stone-500">
                  {s.time}
                </div>
                <div className="min-w-0 flex-1">
                  <SessionCard session={s} showTime={false} />
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {untimed.length === 0 && timed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-card px-3 py-8 text-center text-sm text-stone-600">
            Nothing planned.
          </p>
        ) : null}

        <Link
          href={`/week/${weekId}/add?day=${day}`}
          className="block rounded-md bg-stone-900 px-3 py-3 text-center text-sm font-medium text-white"
        >
          + Add
        </Link>
      </div>
    </div>
  );
}
