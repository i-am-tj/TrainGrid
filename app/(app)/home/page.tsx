import type { Metadata } from "next";
import { Suspense } from "react";
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

  return (
    <DashboardShell
      frame={frame}
      today={
        <Suspense fallback={<SectionLoader label="Loading today’s sessions…" minHeight="min-h-56" />}>
          <TodaySlot today={today} frame={frame} week={week} />
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

async function TodaySlot({ today, frame, week }: { today: MemberToday; frame: DashboardFrame; week: WeekRead }) {
  const result = await week;
  if (!result.ok) return <DashboardSectionError message={WEEK_ERROR} />;
  const { todaySessions } = prepareDashboardWeek(today, result.value);
  return <TodaySessionList sessions={todaySessions} addSessionHref={frame.addSessionHref} />;
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
