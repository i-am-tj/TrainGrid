import Link from "next/link";
import type { ReactNode } from "react";
import {
  EmptyState,
  InlineMessage,
  PageHeading,
} from "@/components/ui/Presentation";
import {
  btnPrimary,
  btnSecondary,
  textLink,
  TYPE_BAR,
  TYPE_TINT,
} from "@/lib/ui";
import { SESSION_TYPE_LABELS } from "@/lib/domain";
import type { DashboardData, DashboardState, DashboardWeek } from "./types";

export type {
  DashboardData,
  DashboardDay,
  DashboardRoutine,
  DashboardSession,
  DashboardState,
  DashboardWeek,
} from "./types";

/** Presentation only. Callers must supply real data; fixtures are never imported here. */
export function MemberDashboard({ state }: { state: DashboardState }) {
  if (state.status === "loading") return <DashboardLoading />;
  if (state.status === "error")
    return (
      <div className="dashboard-container space-y-8">
        <PageHeading
          eyebrow="A little structure for the week"
          title="Your training"
        />
        <div className="max-w-2xl">
          <InlineMessage tone="error">{state.message}</InlineMessage>
          <Link href={state.retryHref} className={`${btnSecondary} mt-5`}>
            Try again
          </Link>
        </div>
      </div>
    );
  const { data } = state;
  return (
    <DashboardShell
      frame={data}
      today={<TodaySessionList sessions={data.todaySessions} addSessionHref={data.addSessionHref} />}
      week={<WeekSummary week={data.week} />}
      routines={
        <RoutineCards
          routines={data.routines}
          createRoutineHref={data.createRoutineHref}
          sharedLibraryHref={data.sharedLibraryHref}
        />
      }
    />
  );
}

export type DashboardFrameData = Omit<DashboardData, "todaySessions" | "week" | "routines">;

/** "Welcome" on the member's first visit after accepting the invitation, then "Welcome back". */
export function greeting({ displayName, firstVisit }: Pick<DashboardData, "displayName" | "firstVisit">): string {
  const word = firstVisit ? "Welcome" : "Welcome back";
  return displayName ? `${word}, ${displayName}.` : `${word}.`;
}

/** A link whose underline sweeps in on hover and focus; its colour stays put. */
const revealLink =
  "underline-reveal-parent rounded-sm text-accent inline-flex min-h-10 items-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

/**
 * The page frame: greeting, section titles, their actions and the quick
 * actions need no query and render at once. The three data slots (today's
 * sessions, the week's counts, the routines) may stream in separately.
 */
export function DashboardShell({
  frame,
  today,
  week,
  routines,
  notice,
  headerAction,
}: {
  frame: DashboardFrameData;
  today: ReactNode;
  week: ReactNode;
  routines: ReactNode;
  /** A small note above the greeting (what's new). */
  notice?: ReactNode;
  /** The main action beside the greeting (Start an unplanned workout); the planner link follows it. */
  headerAction?: ReactNode;
}) {
  return (
    <div className="dashboard-container">
      <header className="flex flex-col items-start justify-between gap-3 border-b border-line pb-4 sm:gap-6 sm:pb-8 sm:flex-row sm:items-end">
        <div className="min-w-0">
          {notice}
          <p className="ui-eyebrow hidden sm:block">Your training, thoughtfully together</p>
          <p className="text-sm text-stone-600 sm:mt-4">{frame.dateLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:mt-2 sm:text-4xl">
            {greeting(frame)}
          </h1>
          <p className="mt-1 text-sm leading-6 text-stone-600 sm:mt-3 sm:leading-7">
            A clear look at today, with the rest of the week in view.
          </p>
        </div>
        {headerAction ? (
          // On phones only the main action shows, so today's sessions stay above the fold;
          // the planner is in the menu (and the week card links to it).
          <div className="flex shrink-0 flex-wrap gap-2">
            {headerAction}
            <Link href={frame.plannerHref} className={`${btnSecondary} shrink-0 gap-5 max-sm:hidden`}>
              Open weekly planner <span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : (
          <Link
            href={frame.plannerHref}
            className={`${btnPrimary} shrink-0 gap-5`}
          >
            Open weekly planner <span aria-hidden="true">↗</span>
          </Link>
        )}
      </header>
      <div className="mt-4 grid min-w-0 gap-4 sm:mt-8 sm:gap-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <section aria-labelledby="today-title" className="min-w-0">
          <SectionTitle
            id="today-title"
            title="Today’s planned sessions"
            action={
              <Link href={frame.addSessionHref} className={btnSecondary}>
                + Add session
              </Link>
            }
          />
          {today}
        </section>
        <aside className="min-w-0" aria-label="This week">
          <section className="ui-panel p-4 sm:p-5" aria-labelledby="week-title">
            <SectionTitle id="week-title" title="This week" />
            <p className="mt-2 text-xs leading-6 text-stone-600">
              Planned sessions · Monday–Sunday
            </p>
            {week}
            <Link href={frame.plannerHref} className={`${revealLink} mt-3`}>
              <span className="underline-reveal">View full planner</span>
              <span aria-hidden="true" className="ml-3">
                ↗
              </span>
            </Link>
          </section>
        </aside>
      </div>
      <section
        className="mt-10 min-w-0 border-t border-line pt-8"
        aria-labelledby="routines-title"
      >
        <SectionTitle
          id="routines-title"
          title="My routines"
          action={
            <Link href={frame.createRoutineHref} className={btnSecondary}>
              + Create routine
            </Link>
          }
        />
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Familiar work, ready for another week.
        </p>
        {routines}
        <Link href={frame.myLibraryHref} className={`${revealLink} mt-5`}>
          <span className="underline-reveal">Browse My Library</span>
          <span aria-hidden="true" className="ml-3">
            ↗
          </span>
        </Link>
      </section>
    </div>
  );
}

/** A section's own failure: the rest of the page stays usable. */
export function DashboardSectionError({ message, retryHref = "/home" }: { message: string; retryHref?: string }) {
  return (
    <div className="mt-5">
      <InlineMessage tone="error">{message}</InlineMessage>
      <Link href={retryHref} className={`${btnSecondary} mt-3`}>
        Try again
      </Link>
    </div>
  );
}

export function TodaySessionList({
  sessions,
  addSessionHref,
  inProgressAction,
  empty,
}: {
  sessions: DashboardData["todaySessions"];
  addSessionHref: string;
  /** An extra action for a session whose workout is in progress (Discard workout). */
  inProgressAction?: (session: DashboardData["todaySessions"][number]) => ReactNode;
  /** Replaces the usual empty state (the first-session invitation). */
  empty?: ReactNode;
}) {
  if (!sessions.length && empty) return empty;
  if (!sessions.length)
    return (
      <div className="mt-5">
        <EmptyState
          title="A little space in your day."
          icon={<PlanningIcon name="week" />}
          action={
            <Link href={addSessionHref} className={btnSecondary}>
              Plan a session
            </Link>
          }
        >
          Nothing is planned for today. Add a session when you’re ready,
          or keep the day open.
        </EmptyState>
      </div>
    );
  return (
    <ul className="mt-5 space-y-3">
      {sessions.map((session) => (
        <li
          key={session.id}
          className={`ui-panel min-w-0 border-l-[3px] p-5 ${TYPE_BAR[session.category]}`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-md px-2 py-1 font-medium ${TYPE_TINT[session.category]}`}
            >
              {SESSION_TYPE_LABELS[session.category]}
            </span>
            <span className="font-mono text-stone-600">
              {session.timeLabel ?? "No set time"}
              {session.durationLabel ? ` · ${session.durationLabel}` : ""}
            </span>
            {session.workout === "completed" ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-900">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                Done
              </span>
            ) : session.workout === "in_progress" ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-900">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                In progress
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">
            <Link
              href={session.href}
              className="rounded-sm hover:underline underline-offset-4"
            >
              {session.name}
            </Link>
          </h3>
          {session.detail && (
            <p className="mt-2 text-sm leading-7 text-stone-600 [overflow-wrap:anywhere]">
              {session.detail}
            </p>
          )}
          {session.workoutHref ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                href={session.workoutHref}
                className={
                  session.workout === "completed"
                    ? `${btnSecondary} min-h-12 rounded-xl px-4`
                    : "workout-log-button ui-control inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold"
                }
                aria-label={`${session.workout === "in_progress" ? "Resume" : session.workout === "completed" ? "View" : "Start"} workout: ${session.name}`}
              >
                {session.workout === "completed" ? null : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
                    <path d="M8 5.5v13l11-6.5-11-6.5z" />
                  </svg>
                )}
                {session.workout === "in_progress" ? "Resume workout" : session.workout === "completed" ? "View workout" : "Start workout"}
              </Link>
              <Link
                href={session.href}
                className={`${textLink} inline-flex min-h-10 items-center text-sm`}
                aria-label={`Session details: ${session.name}`}
              >
                Details
              </Link>
              {session.workout === "in_progress" && inProgressAction ? inProgressAction(session) : null}
            </div>
          ) : (
            <Link
              href={session.href}
              className={`${textLink} mt-4 inline-flex min-h-10 items-center text-sm`}
              aria-label={`Open session: ${session.name}`}
            >
              Open session{" "}
              <span aria-hidden="true" className="ml-3">
                ↗
              </span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function WeekSummary({ week }: { week: DashboardWeek }) {
  return (
    <>
      <WeeklyOverview week={week} />
      <p className="mt-4 text-xs leading-6 text-stone-600">
        {week.every((day) => day.plannedCount === 0)
          ? "An open week. Start with one session and build from there."
          : "Your plan has room to move. Open any day to make it yours."}
      </p>
    </>
  );
}

export function RoutineCards({
  routines,
  createRoutineHref,
  sharedLibraryHref,
}: {
  routines: DashboardData["routines"];
  createRoutineHref: string;
  sharedLibraryHref: string;
}) {
  if (!routines.length)
    return (
      <div className="mt-5">
        <EmptyState
          title="Make a routine your own."
          icon={<PlanningIcon name="routine" />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Link href={createRoutineHref} className={btnSecondary}>
                Create your first routine
              </Link>
              <Link href={sharedLibraryHref} className={revealLink}>
                <span className="underline-reveal">Browse TrainGrid routines</span>
              </Link>
            </div>
          }
        >
          Create a personal routine or copy one from the shared library.
          Your routines are only visible to you.
        </EmptyState>
      </div>
    );
  return (
    <ul className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {routines.map((routine) => (
        <li key={routine.id} className="ui-panel flex min-w-0 flex-col p-5">
          <p className="ui-eyebrow">
            {routine.categoryLabel}{" "}
            <span className="text-stone-600">· Mine</span>
          </p>
          <h3 className="mt-3 text-base font-semibold leading-7 [overflow-wrap:anywhere]">
            <Link
              href={routine.viewHref}
              className="rounded-sm hover:underline underline-offset-4"
            >
              {routine.name}
            </Link>
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-600 [overflow-wrap:anywhere]">
            {routine.detail}
          </p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
            <Link
              href={routine.viewHref}
              className={`${textLink} inline-flex min-h-10 items-center text-sm`}
              aria-label={`View routine: ${routine.name}`}
            >
              View routine
            </Link>
            <Link
              href={routine.scheduleHref}
              className={btnSecondary}
              aria-label={`Schedule routine: ${routine.name}`}
            >
              Schedule
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function WeeklyOverview({ week }: { week: DashboardWeek }) {
  return (
    <nav aria-label="Weekly planned sessions" className="mt-4">
      <ol className="grid grid-cols-7 gap-1">
        {week.map((day) => (
          <li key={day.date} className="min-w-0">
            <Link
              href={day.href}
              aria-current={day.isSelected ? "date" : undefined}
              aria-label={`${day.weekdayLabel} ${day.dayLabel}${day.isToday ? ", today" : ""}: ${day.plannedCount} planned ${day.plannedCount === 1 ? "session" : "sessions"}`}
              className={`dashboard-day flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border px-0.5 py-3 text-xs ${day.isSelected ? "border-accent bg-background" : "border-transparent hover:border-line hover:bg-background"}`}
            >
              <span className="text-stone-600">{day.weekdayLabel}</span>
              <span
                className={`font-semibold ${day.isToday ? "text-accent" : ""}`}
              >
                {day.dayLabel}
              </span>
              <span
                className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] ${day.plannedCount ? "bg-stone-900 text-white" : "text-stone-600"}`}
              >
                {day.plannedCount || "—"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DashboardLoading() {
  return (
    <div className="dashboard-container" aria-busy="true">
      <PageHeading
        eyebrow="Your week, coming into view"
        title="Your training"
      />
      <p role="status" className="mt-3 text-sm text-stone-600">
        Loading your training plan…
      </p>
      <div
        aria-hidden="true"
        className="mt-8 grid gap-6 lg:grid-cols-[1.8fr_1fr]"
      >
        <div className="ui-panel p-6">
          <div className="dashboard-skeleton h-5 w-2/3" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="mt-6 rounded-xl border border-line p-5">
              <div className="dashboard-skeleton h-3 w-1/3" />
              <div className="dashboard-skeleton mt-4 h-5 w-3/4" />
              <div className="dashboard-skeleton mt-4 h-3 w-full" />
            </div>
          ))}
        </div>
        <div className="ui-panel p-6">
          <div className="dashboard-skeleton h-5 w-1/2" />
          <div className="mt-7 grid grid-cols-7 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="dashboard-skeleton h-20" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanningIcon({ name }: { name: "week" | "routine" }) {
  return (
    <svg aria-hidden="true" className="size-7" viewBox="0 0 40 40">
      <use href={`/marketing/features.svg#${name}`} />
    </svg>
  );
}
