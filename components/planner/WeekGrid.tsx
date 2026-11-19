"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { IsoDay, PlannerSession } from "@/lib/domain";
import {
  datesOfWeek,
  formatDayHeading,
  formatHourLabel,
  formatShortDate,
  hourFromTime,
  HOURS,
} from "@/lib/week";
import { compareSessions } from "@/lib/domain";
import { dateOfWeekDay } from "@/lib/calendar-date";
import { SessionCard } from "./SessionCard";

const ROW = 56;
const UNTIMED = 52;

export function WeekGrid({
  weekId,
  sessions,
  todayDay,
}: {
  weekId: string;
  sessions: PlannerSession[];
  /**
   * The member's today in this week (decided on the server in their time
   * zone, lib/today.ts), or null. Never the render-time clock: the server
   * renders in UTC, so `new Date()` here would disagree with the browser.
   */
  todayDay: IsoDay | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const dates = datesOfWeek(weekId);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = UNTIMED + 6 * ROW;
  }, [weekId]);

  return (
    <div
      ref={scroller}
      className="planner-grid mt-3 overflow-auto rounded-xl border border-line bg-card"
      role="region"
      aria-label="Weekly calendar time grid"
      tabIndex={0}
    >
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}
      >
        <div className="sticky top-0 z-20 border-b border-line bg-card" />
        {dates.map((date, i) => {
          const heading = formatDayHeading(date);
          const isToday = i + 1 === todayDay;
          return (
            <div
              key={i}
              data-today={isToday || undefined}
              data-date={isToday ? dateOfWeekDay(weekId, todayDay) : undefined}
              className={`sticky top-0 z-20 border-b border-l border-line px-1 py-2 text-center ${
                isToday ? "bg-amber-50" : "bg-card"
              }`}
            >
              <div className="text-[11px] font-semibold tracking-wide text-stone-600">
                {heading.weekday}
              </div>
              <div className="text-sm font-semibold">{heading.dayNum}</div>
            </div>
          );
        })}

        <div className="border-b border-line bg-stone-50 px-1 py-1 text-[10px] text-stone-600">
          —
        </div>
        {dates.map((date, i) => {
          const day = (i + 1) as IsoDay;
          const untimed = sessions
            .filter((s) => s.day === day && s.time === null)
            .sort(compareSessions);
          const isToday = day === todayDay;
          return (
            <div
              key={`u-${i}`}
              className={`border-b border-l border-line p-1 ${
                isToday ? "bg-amber-50/40" : ""
              }`}
              style={{ minHeight: UNTIMED }}
            >
              <Link
                prefetch={false}
                href={`/week/${weekId}/add?day=${day}&untimed=1`}
                className="mb-1 block text-[10px] text-stone-600 hover:text-stone-700"
              >
                + untimed
              </Link>
              <div className="flex flex-col gap-1">
                {untimed.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          );
        })}

        {HOURS.map((hour) => (
          <HourRow
            key={hour}
            hour={hour}
            weekId={weekId}
            dates={dates}
            sessions={sessions}
            todayDay={todayDay}
          />
        ))}
      </div>
    </div>
  );
}

function HourRow({
  hour,
  weekId,
  dates,
  sessions,
  todayDay,
}: {
  hour: number;
  weekId: string;
  dates: Date[];
  sessions: PlannerSession[];
  todayDay: IsoDay | null;
}) {
  return (
    <>
      <div
        className="border-b border-line px-1 py-1 text-[11px] text-stone-600"
        style={{ minHeight: ROW }}
      >
        {formatHourLabel(hour)}
      </div>
      {dates.map((date, i) => {
        const day = (i + 1) as IsoDay;
        const cell = sessions
          .filter(
            (s) =>
              s.day === day && s.time !== null && hourFromTime(s.time) === hour,
          )
          .sort(compareSessions);
        const isToday = day === todayDay;
        const time = formatHourLabel(hour);
        return (
          <div
            key={`${hour}-${i}`}
            className={`border-b border-l border-line p-1 ${
              isToday ? "bg-amber-50/30" : ""
            }`}
            style={{ minHeight: ROW }}
          >
            <div className="flex flex-col gap-1">
              {cell.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
            <Link
              prefetch={false}
              href={`/week/${weekId}/add?day=${day}&time=${time}`}
              className="mt-0.5 block min-h-6 text-[10px] text-transparent hover:text-stone-600 focus-visible:text-stone-700"
              aria-label={`Add session ${formatShortDate(date)} ${time}`}
            >
              +
            </Link>
          </div>
        );
      })}
    </>
  );
}
