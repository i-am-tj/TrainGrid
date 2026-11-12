import type { PlannerSession } from "@/lib/domain";
import type { ScheduledSessionRecord } from "./model";

/** The fields the planner grid and agenda show. */
export function toPlannerSession(session: ScheduledSessionRecord): PlannerSession {
  return {
    id: session.id,
    name: session.name,
    type: session.category,
    weekId: session.weekId,
    day: session.day,
    time: session.startTime,
    durationMinutes: session.durationMinutes,
  };
}
