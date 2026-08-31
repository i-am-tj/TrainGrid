"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { IsoDay, ResolvedSession } from "@/lib/domain";
import {
  datesOfWeek,
  formatDayHeading,
  formatHourLabel,
  formatShortDate,
  hourFromTime,
  HOURS,
  sameLocalDay,
} from "@/lib/week";
import { compareSessions } from "@/lib/domain";
import { SessionCard } from "./SessionCard";

const ROW = 56;
const UNTIMED = 52;

export function WeekGrid({
  weekId,
  sessions,
}: {
  weekId: string;
  sessions: ResolvedSession[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const dates = datesOfWeek(weekId);
  const now = new Date();

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = UNTIMED + 6 * ROW;
  }, [weekId]);

  return (
    <div
      ref={scroller}
      className="mt-3 max-h-[calc(100vh-9rem)] overflow-auto rounded-lg border border-line bg-card"
    >
      <div
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}
      >
        <div className="sticky top-0 z-20 border-b border-line bg-card" />
        {dates.map((date, i) => {
          const heading = formatDayHeading(date);
          const isToday = sameLocalDay(date, now);
          return (
            <div
              key={i}
              className={`sticky top-0 z-20 border-b border-l border-line bg-card px-1 py-2 text-center ${
                isToday ? "bg-amber-50" : ""
              }`}
            >
              <div className="text-[11px] font-semibold tracking-wide text-stone-500">
                {heading.weekday}
              </div>
              <div className="text-sm font-semibold">{heading.dayNum}</div>
            </div>
          );
        })}

        <div className="border-b border-line bg-stone-50 px-1 py-1 text-[10px] text-stone-500">
          —
        </div>
        {dates.map((date, i) => {
          const day = (i + 1) as IsoDay;
          const untimed = sessions
            .filter((s) => s.day === day && s.time === null)
            .sort(compareSessions);
          const isToday = sameLocalDay(date, now);
          return (
            <div
              key={`u-${i}`}
              className={`min-h-[${UNTIMED}px] border-b border-l border-line p-1 ${
                isToday ? "bg-amber-50/40" : ""
              }`}
              style={{ minHeight: UNTIMED }}
            >
              <Link
                href={`/week/${weekId}/add?day=${day}&untimed=1`}
                className="mb-1 block text-[10px] text-stone-400 hover:text-stone-700"
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
            now={now}
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
  now,
}: {
  hour: number;
  weekId: string;
  dates: Date[];
  sessions: ResolvedSession[];
  now: Date;
}) {
  return (
    <>
      <div
        className="border-b border-line px-1 py-1 text-[11px] text-stone-500"
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
        const isToday = sameLocalDay(date, now);
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
              href={`/week/${weekId}/add?day=${day}&time=${time}`}
              className="mt-0.5 block min-h-[1.25rem] text-[10px] text-transparent hover:text-stone-500"
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
