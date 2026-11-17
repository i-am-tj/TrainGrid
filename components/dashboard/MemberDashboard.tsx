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
    <div className="dashboard-container">
      <header className="flex flex-col items-start justify-between gap-6 border-b border-line pb-8 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="ui-eyebrow">Your training, thoughtfully together</p>
          <p className="mt-4 text-sm text-stone-600">{data.dateLabel}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
            {data.displayName
              ? `Welcome back, ${data.displayName}.`
              : "Welcome back."}
          </h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            A clear look at today, with the rest of the week in view.
          </p>
        </div>
        <Link
          href={data.plannerHref}
          className={`${btnPrimary} shrink-0 gap-5`}
        >
          Open weekly planner <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <section aria-labelledby="today-title" className="min-w-0">
          <SectionTitle
            id="today-title"
            title="Today’s planned sessions"
            action={
              <Link href={data.addSessionHref} className={btnSecondary}>
                + Add session
              </Link>
            }
          />
          {data.todaySessions.length ? (
            <ul className="mt-5 space-y-3">
              {data.todaySessions.map((session) => (
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
                      {session.durationLabel
                        ? ` · ${session.durationLabel}`
                        : ""}
                    </span>
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
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="A little space in your day."
                icon={<PlanningIcon name="week" />}
                action={
                  <Link href={data.addSessionHref} className={btnSecondary}>
                    Plan a session
                  </Link>
                }
              >
                Nothing is planned for today. Add a session when you’re ready,
                or keep the day open.
              </EmptyState>
            </div>
          )}
        </section>
        <aside className="min-w-0 space-y-7" aria-label="Week and shortcuts">
          <section className="ui-panel p-4 sm:p-5" aria-labelledby="week-title">
            <SectionTitle id="week-title" title="This week" />
            <p className="mt-2 text-xs leading-6 text-stone-600">
              Planned sessions · Monday–Sunday
            </p>
            <WeeklyOverview week={data.week} />
            <p className="mt-4 text-xs leading-6 text-stone-600">
              {data.week.every((day) => day.plannedCount === 0)
                ? "An open week. Start with one session and build from there."
                : "Your plan has room to move. Open any day to make it yours."}
            </p>
            <Link
              href={data.plannerHref}
              className={`${textLink} mt-3 inline-flex min-h-10 items-center text-sm`}
            >
              View full planner{" "}
              <span aria-hidden="true" className="ml-3">
                ↗
              </span>
            </Link>
          </section>
          <QuickActions data={data} />
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
            <Link href={data.createRoutineHref} className={btnSecondary}>
              + Create routine
            </Link>
          }
        />
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Familiar work, ready for another week.
        </p>
        {data.routines.length ? (
          <ul className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.routines.map((routine) => (
              <li
                key={routine.id}
                className="ui-panel flex min-w-0 flex-col p-5"
              >
                <p className="ui-eyebrow">
                  {routine.categoryLabel}{" "}
                  <span className="text-stone-500">· Mine</span>
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
        ) : (
          <div className="mt-5">
            <EmptyState
              title="Make a routine your own."
              icon={<PlanningIcon name="routine" />}
              action={
                <>
                  <Link href={data.createRoutineHref} className={btnSecondary}>
                    Create your first routine
                  </Link>
                  <Link href={data.sharedLibraryHref} className={textLink}>
                    Browse TrainGrid routines
                  </Link>
                </>
              }
            >
              Create a personal routine or copy one from the shared library.
              Your routines are only visible to you.
            </EmptyState>
          </div>
        )}
        <Link
          href={data.myLibraryHref}
          className={`${textLink} mt-5 inline-flex min-h-10 items-center text-sm`}
        >
          Browse My Library{" "}
          <span aria-hidden="true" className="ml-3">
            ↗
          </span>
        </Link>
      </section>
    </div>
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
                className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] ${day.plannedCount ? "bg-stone-900 text-white" : "text-stone-500"}`}
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

function QuickActions({ data }: { data: DashboardData }) {
  const actions = [
    [
      "Add session",
      "time",
      data.addSessionHref,
      "Make room for the next workout",
    ],
    ["Open planner", "week", data.plannerHref, "See the week together"],
    [
      "Browse TrainGrid library",
      "library",
      data.sharedLibraryHref,
      "Find a routine to start from",
    ],
    [
      "Create routine",
      "routine",
      data.createRoutineHref,
      "Build something personal",
    ],
  ];
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="text-lg font-semibold tracking-tight">
        Quick actions
      </h2>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-card">
        {actions.map(([title, icon, href, description]) => (
          <li key={title}>
            <Link
              href={href!}
              className="dashboard-shortcut flex min-h-16 min-w-0 items-center gap-3 rounded-lg px-4 py-3"
            >
              <svg
                aria-hidden="true"
                className="size-7 shrink-0 text-accent"
                viewBox="0 0 40 40"
              >
                <use href={`/marketing/features.svg#${icon}`} />
              </svg>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-stone-600">
                  {description}
                </span>
              </span>
              <span aria-hidden="true" className="ml-auto text-stone-500">
                ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
