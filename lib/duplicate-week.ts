import type { ScheduledSession } from "./domain";

export function duplicateWeekSessions(
  sessions: ScheduledSession[],
  sourceWeekId: string,
  destWeekId: string,
  newId: () => string = () => crypto.randomUUID(),
): ScheduledSession[] {
  if (sourceWeekId === destWeekId) {
    throw new Error("Choose a different week");
  }
  return sessions
    .filter((session) => session.weekId === sourceWeekId)
    .map((session) => ({
      ...session,
      id: newId(),
      weekId: destWeekId,
    }));
}
