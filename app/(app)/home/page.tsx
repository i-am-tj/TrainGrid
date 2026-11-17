import type { Metadata } from "next";
import { MemberDashboard, type DashboardState } from "@/components/dashboard/MemberDashboard";
import { prepareDashboard } from "@/lib/dashboard/prepare";
import { listOwnRoutinesForDashboard } from "@/lib/data/dashboard";
import { memberData } from "@/lib/data/server";
import { listSessionsForWeek } from "@/lib/data/sessions";
import { requireMember } from "@/lib/auth/session";
import { getRequestToday } from "@/lib/today";

export const metadata: Metadata = {
  title: "Home · TrainGrid",
  robots: { index: false, follow: false },
};

/**
 * The member's home: today's planned sessions, this week's planned counts and
 * their own routines. Members only (requireMember via memberData); every
 * query runs as the member under RLS and is narrowed to their user id.
 *
 * A failed read shows the error state with a retry link. Empty sections are
 * shown only after a successful, empty read — never as a stand-in for failure.
 */
export default async function MemberHomePage() {
  const member = await requireMember();
  const { db, userId } = await memberData();
  const today = await getRequestToday();

  let state: DashboardState;
  try {
    const [weekSessions, routines] = await Promise.all([
      listSessionsForWeek(db, userId, today.weekId),
      listOwnRoutinesForDashboard(db, userId),
    ]);
    state = {
      status: "ready",
      data: prepareDashboard({
        today,
        displayName: member.displayName,
        weekSessions,
        routines,
      }),
    };
  } catch {
    state = {
      status: "error",
      message: "We couldn’t load your training plan just now. Your sessions and routines are safe.",
      retryHref: "/home",
    };
  }

  return <MemberDashboard state={state} />;
}
