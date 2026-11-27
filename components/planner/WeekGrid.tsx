"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
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
/** The hour the grid opens at, unless a session this week starts earlier. */
const START_HOUR = 6;
const COLUMNS = { gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" };
/**
 * The most of the grid's height the headings and untimed row may hold while
 * pinned. A longer untimed list (many sessions, or a short landscape window)
 * scrolls with the hours instead, so it can't cover them.
 */
const MAX_PINNED = 0.5;
/** The untimed row's index in slot navigation, above hour 0. */
const UNTIMED_ROW = -1;

/*
 * Keyboard model (UI_DESIGN_AUDIT rank 3). Tab reaches the grid, then only
 * the scheduled sessions, then leaves: the 175 empty-slot add links are not
 * tab stops. Arrow keys on the grid, a slot or a session move between slots
 * (day × untimed/hour); Enter on a slot opens Add session for it; Escape
 * returns focus to the grid. Pointer scheduling is unchanged.
 */
const MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function slotOf(el: Element | null): [number, number] | null {
  const cell = el?.closest<HTMLElement>("[data-slot]");
  if (!cell) return null;
  const [day, row] = cell.dataset.slot!.split(":").map(Number);
  return [day!, row!];
}

function addLinkAt(region: HTMLElement, day: number, row: number) {
  return region.querySelector<HTMLElement>(`[data-slot="${day}:${row}"] [data-add]`);
}

/**
 * Scrolls the focused control `el` fully into the grid's view: below `inset`
 * (the pinned rows above it, or 0 when `el` is itself in a pinned row) and
 * above the grid's bottom edge. Measures `el` itself, not its cell: a cell
 * crowded with sessions can be taller than the grid, its Add link at the
 * bottom. Something taller than the view keeps its top in view.
 */
function reveal(region: HTMLElement, el: HTMLElement, inset: number) {
  const view = region.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const top = view.top + region.clientTop + inset;
  const bottom = view.top + region.clientTop + region.clientHeight;
  if (box.top < top) region.scrollTop -= top - box.top;
  else if (box.bottom > bottom) region.scrollTop += Math.min(box.bottom - bottom, box.top - top);
}

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
  const headings = useRef<HTMLDivElement>(null);
  const untimedRow = useRef<HTMLDivElement>(null);
  const dates = datesOfWeek(weekId);
  const hintId = useId();
  // Untimed work is pinned under the day headings, so it is on screen however
  // far the hours are scrolled (UI_DESIGN_AUDIT rank 2). An empty untimed row
  // scrolls away with the hours instead of taking space, and so does one too
  // tall to leave room for the hours (see MAX_PINNED).
  const hasUntimed = sessions.some((s) => s.time === null);
  const firstHour = Math.min(
    START_HOUR,
    ...sessions.flatMap((s) => (s.time === null ? [] : [hourFromTime(s.time)])),
  );
  const [layout, setLayout] = useState({ untimedFits: true, headingsHeight: 0 });
  const pinUntimed = hasUntimed && layout.untimedFits;

  function measure() {
    const el = scroller.current;
    const head = headings.current?.offsetHeight ?? 0;
    const untimed = untimedRow.current?.offsetHeight ?? 0;
    return {
      untimedFits: !el || head + untimed <= el.clientHeight * MAX_PINNED,
      headingsHeight: head,
    };
  }

  useLayoutEffect(() => {
    const update = () =>
      setLayout((prev) => {
        const next = measure();
        return next.untimedFits === prev.untimedFits &&
          next.headingsHeight === prev.headingsHeight
          ? prev
          : next;
      });
    update();
    const observer = new ResizeObserver(update);
    for (const el of [scroller.current, headings.current, untimedRow.current])
      if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** The height of the rows pinned at the top of the grid right now. */
  function pinnedHeight() {
    const untimed = untimedRow.current;
    return (
      (headings.current?.offsetHeight ?? 0) +
      (untimed?.hasAttribute("data-pinned") ? untimed.offsetHeight : 0)
    );
  }

  // Opens at the first hour, just below the pinned rows; again whenever the
  // untimed row is pinned or unpinned (the window or the page around the grid
  // changed size), so an unpinned list is never left scrolled out of sight.
  useEffect(() => {
    const el = scroller.current;
    const row = el?.querySelector<HTMLElement>(`[data-hour="${firstHour}"]`);
    if (!el || !row) return;
    const { untimedFits, headingsHeight } = measure();
    if (hasUntimed && !untimedFits) {
      // The untimed list leads the scrolling content; open on it.
      el.scrollTop = 0;
      return;
    }
    const offset =
      row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTop =
      offset - headingsHeight - (hasUntimed ? (untimedRow.current?.offsetHeight ?? 0) : 0);
  }, [weekId, firstHour, hasUntimed, pinUntimed]);

  /** Reveals a control in the grid, allowing for whatever is pinned above it. */
  function revealInGrid(region: HTMLElement, el: HTMLElement) {
    const untimed = untimedRow.current;
    const stuck = untimed?.hasAttribute("data-pinned") && untimed.contains(el);
    reveal(region, el, stuck ? 0 : pinnedHeight());
  }

  // Keyboard focus from anywhere (Tab, Shift+Tab, arrows) lands in view: the
  // browser's own focus scrolling doesn't allow for the sticky rows. Pointer
  // focus (not :focus-visible) leaves the scroll position alone.
  function onFocus(event: FocusEvent<HTMLDivElement>) {
    const region = scroller.current;
    const el = event.target;
    if (!region || el === region || !(el instanceof HTMLElement)) return;
    if (el.matches(":focus-visible")) revealInGrid(region, el);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const region = scroller.current;
    if (!region || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "Escape" && event.target !== region) {
      event.preventDefault();
      region.focus();
      return;
    }
    const move = MOVES[event.key];
    if (!move) return;
    const from = slotOf(event.target as Element);
    let next: [number, number];
    if (from) {
      next = [
        Math.min(7, Math.max(1, from[0] + move[0])),
        Math.min(HOURS.length - 1, Math.max(UNTIMED_ROW, from[1] + move[1])),
      ];
    } else if (event.target === region) {
      // Entering slot selection: today's column (else Monday), at the first hour in view.
      const top = region.getBoundingClientRect().top + pinnedHeight();
      const hour = HOURS.find((h) => {
        const label = region.querySelector(`[data-hour="${h}"]`);
        return label !== null && label.getBoundingClientRect().bottom > top + 1;
      });
      next = [todayDay ?? 1, hour ?? firstHour];
    } else return;
    const link = addLinkAt(region, next[0], next[1]);
    if (!link) return;
    event.preventDefault();
    link.focus({ preventScroll: true });
    revealInGrid(region, link);
  }

  return (
    <div
      ref={scroller}
      className="planner-grid mt-3 overflow-auto rounded-xl border border-line bg-card"
      role="region"
      aria-label="Weekly calendar time grid"
      aria-describedby={hintId}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <p id={hintId} className="sr-only">
        Tab moves between scheduled sessions. Arrow keys choose a day and time slot, Enter adds a
        session there, and Escape returns to the calendar.
      </p>
      <div className="min-w-[720px]">
        <div
          ref={headings}
          data-testid="planner-pinned"
          className="sticky top-0 z-20 grid bg-card"
          style={COLUMNS}
        >
          <div className="border-b border-line" />
          {dates.map((date, i) => {
            const heading = formatDayHeading(date);
            const isToday = i + 1 === todayDay;
            return (
              <div
                key={i}
                data-today={isToday || undefined}
                data-date={isToday ? dateOfWeekDay(weekId, todayDay) : undefined}
                className={`border-b border-l border-line px-1 py-2 text-center ${
                  isToday ? "bg-amber-50" : ""
                }`}
              >
                <div className="text-[11px] font-semibold tracking-wide text-stone-600">
                  {heading.weekday}
                </div>
                <div className="text-sm font-semibold">{heading.dayNum}</div>
              </div>
            );
          })}
        </div>

        <div
          ref={untimedRow}
          data-testid="planner-untimed"
          data-pinned={pinUntimed || undefined}
          className={`grid bg-card ${pinUntimed ? "sticky z-10" : ""}`}
          style={{ ...COLUMNS, top: pinUntimed ? layout.headingsHeight : undefined }}
        >
          <UntimedRow weekId={weekId} dates={dates} sessions={sessions} todayDay={todayDay} />
        </div>

        <div className="grid" style={COLUMNS}>
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
    </div>
  );
}

function UntimedRow({
  weekId,
  dates,
  sessions,
  todayDay,
}: {
  weekId: string;
  dates: Date[];
  sessions: PlannerSession[];
  todayDay: IsoDay | null;
}) {
  return (
    <>
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
            data-slot={`${day}:${UNTIMED_ROW}`}
            className={`border-b border-l border-line p-1 ${
              isToday ? "bg-amber-50/40" : ""
            }`}
            style={{ minHeight: UNTIMED }}
          >
            <Link
              prefetch={false}
              href={`/week/${weekId}/add?day=${day}&untimed=1`}
              tabIndex={-1}
              data-add
              className="mb-1 block rounded-sm text-[10px] text-stone-600 hover:text-stone-700 focus-visible:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900"
              aria-label={`Add untimed session ${formatShortDate(date)}`}
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
    </>
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
        data-hour={hour}
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
            data-slot={`${day}:${hour}`}
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
              tabIndex={-1}
              data-add
              className="group/add mt-0.5 block min-h-6 rounded-sm px-0.5 text-[10px] text-transparent hover:text-stone-600 focus-visible:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900"
              aria-label={`Add session ${formatShortDate(date)} ${time}`}
            >
              + <span className="hidden group-focus-visible/add:inline">Add {time}</span>
            </Link>
          </div>
        );
      })}
    </>
  );
}
