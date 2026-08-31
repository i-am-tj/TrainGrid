export const SESSION_TYPES = [
  "running",
  "strength",
  "plyometrics",
  "other",
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  running: "Running",
  strength: "Strength",
  plyometrics: "Plyometrics",
  other: "Other",
};

export const EQUIPMENT_TYPES = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "resistance-band",
  "machine",
  "cable",
  "bench",
  "pull-up-bar",
  "plyometric-box",
  "other",
] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  bodyweight: "Bodyweight",
  dumbbell: "Dumbbell",
  kettlebell: "Kettlebell",
  barbell: "Barbell",
  "resistance-band": "Resistance Band",
  machine: "Machine",
  cable: "Cable",
  bench: "Bench",
  "pull-up-bar": "Pull-up Bar",
  "plyometric-box": "Plyometric Box",
  other: "Other",
};

export function isEquipmentType(value: string): value is EquipmentType {
  return (EQUIPMENT_TYPES as readonly string[]).includes(value);
}

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
  equipment: EquipmentType[];
  videoUrl: string | null;
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
