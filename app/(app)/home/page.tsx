import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import Link from "next/link";
import { FirstSessionInvite } from "@/components/dashboard/FirstSessionInvite";
import { QuickStart } from "@/components/dashboard/QuickStart";
import { DiscardWorkoutButton } from "@/components/workout/DiscardWorkoutButton";
import { displayVersion, isRecentRelease } from "@/lib/changelog";
import { loadReleases } from "@/lib/changelog-file";
import {
  DashboardSectionError,
  DashboardShell,
  RoutineCards,
  TodaySessionList,
  WeekSummary,
} from "@/components/dashboard/MemberDashboard";
import { SectionLoader } from "@/components/LogoLoader";
import {
  prepareDashboardFrame,
  prepareDashboardRoutines,
  prepareDashboardWeek,
  type DashboardFrame,
} from "@/lib/dashboard/prepare";
import { listOwnRoutinesForDashboard } from "@/lib/data/dashboard";
import { hasPlannedSession } from "@/lib/data/onboarding";
import { ONBOARDING_DISMISSED_COOKIE, showFirstSessionInvite } from "@/lib/onboarding/model";
import type { ScheduledSessionRecord } from "@/lib/data/model";
import { memberData } from "@/lib/data/server";
import { listSessionsForWeek } from "@/lib/data/sessions";
import { requireMember } from "@/lib/auth/session";
import type { MemberToday } from "@/lib/time-zone";
import { getRequestToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Home · TrainGrid",
  robots: { index: false, follow: false },
};

/** A read that never rejects, so a section can fail on its own. */
type Settled<T> = { ok: true; value: T } | { ok: false };

function settle<T>(read: Promise<T>): Promise<Settled<T>> {
  return read.then(
    (value) => ({ ok: true, value }) as const,
    () => ({ ok: false }) as const,
  );
}

const WEEK_ERROR = "We couldn’t load this week’s sessions just now. They’re safe.";
const ROUTINES_ERROR = "We couldn’t load your routines just now. They’re safe.";

/**
 * The member's home: today's planned sessions, this week's planned counts and
 * their own routines. Members only (requireMember via memberData); every
 * query runs as the member under RLS and is narrowed to their user id.
 *
 * The greeting, section titles and shortcuts render at once; the week and
 * the routines are read in parallel and each streams in behind its own
 * section loader. A failed read shows that section's error with a retry
 * link. Empty sections are shown only after a successful, empty read —
 * never as a stand-in for failure.
 */
export default async function MemberHomePage() {
  const member = await requireMember();
  const { db, userId } = await memberData();
  const today = await getRequestToday();

  const frame = prepareDashboardFrame({
    today,
    displayName: member.displayName,
    firstVisit: member.firstVisit,
  });
  const week = settle(listSessionsForWeek(db, userId, today.weekId));
  const routines = settle(listOwnRoutinesForDashboard(db, userId));

  // The first-session invitation replaces Today's empty state for a member
  // who has never planned anything (PRODUCT_AUDIT F14). Its one count runs
  // only when this week is empty and the member hasn't hidden it.
  const dismissed = (await cookies()).get(ONBOARDING_DISMISSED_COOKIE)?.value === "1";
  const [latest] = await loadReleases();
  // Anything this week means a session was planned; otherwise ask once. A
  // failed read keeps the usual empty state.
  const firstSession: Promise<boolean> = dismissed
    ? Promise.resolve(false)
    : week.then(
        async (result) =>
          result.ok &&
          result.value.length === 0 &&
          showFirstSessionInvite(await hasPlannedSession(db, userId).catch(() => null), false),
      );

  return (
    <DashboardShell
      frame={frame}
      headerAction={<QuickStart leadsElsewhere={leadsElsewhere(today, week, firstSession)} />}
      notice={
        latest && isRecentRelease(latest, today.date) ? (
          <Link
            href="/whats-new"
            className="underline-reveal-parent group mb-2 inline-flex max-w-full items-center gap-2 rounded-lg sm:mb-5 sm:rounded-full border border-line bg-card py-1 pl-1 pr-3 text-xs text-stone-700 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-white">New</span>
            <span>
              <span className="hidden sm:inline">TrainGrid {displayVersion(latest.version)} is here · </span>
              <span className="sm:hidden">{displayVersion(latest.version)} · </span>
              <span className="underline-reveal">See what’s new</span>
            </span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
              →
            </span>
          </Link>
        ) : null
      }
      today={
        <Suspense fallback={<SectionLoader label="Loading today’s sessions…" minHeight="min-h-56" />}>
          <TodaySlot today={today} frame={frame} week={week} firstSession={firstSession} />
        </Suspense>
      }
      week={
        <Suspense fallback={<SectionLoader label="Loading your week…" minHeight="min-h-32" />}>
          <WeekSlot today={today} week={week} />
        </Suspense>
      }
      routines={
        <Suspense fallback={<SectionLoader label="Loading your routines…" minHeight="min-h-48" />}>
          <RoutinesSlot today={today} frame={frame} routines={routines} />
        </Suspense>
      }
    />
  );
}

type WeekRead = Promise<Settled<ScheduledSessionRecord[]>>;

/**
 * Whether Home already leads with something to do (a session today that
 * isn't finished, or the first-routine invitation), so its unplanned start
 * steps back to a secondary button (UI_DESIGN_AUDIT rank 6).
 */
async function leadsElsewhere(today: MemberToday, week: WeekRead, firstSession: Promise<boolean>) {
  const result = await week;
  const planned =
    result.ok &&
    prepareDashboardWeek(today, result.value).todaySessions.some((session) => session.workout !== "completed");
  return planned || (await firstSession);
}

async function TodaySlot({
  today,
  frame,
  week,
  firstSession: invite,
}: {
  today: MemberToday;
  frame: DashboardFrame;
  week: WeekRead;
  /** Whether to invite a first session (false once the member has hidden the invitation). */
  firstSession: Promise<boolean>;
}) {
  const result = await week;
  if (!result.ok) return <DashboardSectionError message={WEEK_ERROR} />;
  const { todaySessions } = prepareDashboardWeek(today, result.value);
  const firstSession = await invite;
  return (
    <TodaySessionList
      sessions={todaySessions}
      addSessionHref={frame.addSessionHref}
      empty={
        firstSession ? (
          <FirstSessionInvite libraryHref={frame.sharedLibraryHref} addSessionHref={frame.addSessionHref} />
        ) : undefined
      }
      inProgressAction={(session) => (
        <DiscardWorkoutButton sessionId={session.id} name={session.name} quick={session.quick === true} variant="link" />
      )}
    />
  );
}

async function WeekSlot({ today, week }: { today: MemberToday; week: WeekRead }) {
  const result = await week;
  // Today's section already explains the failure and offers the retry.
  if (!result.ok) return <p className="mt-4 text-xs leading-6 text-stone-600">This week’s counts aren’t available right now.</p>;
  return <WeekSummary week={prepareDashboardWeek(today, result.value).week} />;
}

async function RoutinesSlot({
  today,
  frame,
  routines,
}: {
  today: MemberToday;
  frame: DashboardFrame;
  routines: Promise<Settled<Awaited<ReturnType<typeof listOwnRoutinesForDashboard>>>>;
}) {
  const result = await routines;
  if (!result.ok) return <DashboardSectionError message={ROUTINES_ERROR} />;
  return (
    <RoutineCards
      routines={prepareDashboardRoutines(today, result.value)}
      createRoutineHref={frame.createRoutineHref}
      sharedLibraryHref={frame.sharedLibraryHref}
    />
  );
}
