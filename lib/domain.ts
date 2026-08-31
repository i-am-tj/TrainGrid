export const SESSION_TYPES = [
  "running",
  "strength",
  "mobility",
  "other",
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

export type IsoDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SessionTemplate = {
  id: string;
  name: string;
  type: SessionType;
  description: string;
  body: string;
};

export type ScheduledSession = {
  id: string;
  name: string;
  type: SessionType;
  weekId: string;
  day: IsoDay;
  time: string | null;
  durationMinutes: number | null;
  notes: string;
  templateId: string | null;
  bodySnapshot: string | null;
};

export type SessionSource = "template" | "snapshot" | "adhoc";

export type ResolvedSession = ScheduledSession & {
  body: string;
  source: SessionSource;
};

export type WorkoutItem = {
  id: string;
  title: string;
  body: string;
};

export type ScheduleFile = {
  sessions: ScheduledSession[];
};

export type BackupFile = {
  version: 1;
  exportedAt: string;
  templates: SessionTemplate[];
  sessions: ScheduledSession[];
};

export function isSessionType(value: string): value is SessionType {
  return (SESSION_TYPES as readonly string[]).includes(value);
}

export const MAX_NAME_LENGTH = 200;

export function sanitizeName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

export function compareSessions(
  a: ScheduledSession,
  b: ScheduledSession,
): number {
  if (a.time === null && b.time !== null) return -1;
  if (a.time !== null && b.time === null) return 1;
  if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
  return a.id.localeCompare(b.id);
}
