import { mkdir, readFile } from "fs/promises";
import {
  isSessionType,
  type IsoDay,
  type ScheduleFile,
  type ScheduledSession,
  type SessionType,
} from "./domain";
import { writeAtomic } from "./fs-utils";
import { getSchedulePath } from "./paths";
import { isValidTime, isValidWeekId } from "./week";
import path from "path";

function isIsoDay(value: unknown): value is IsoDay {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 7
  );
}

export function coerceSession(raw: unknown): ScheduledSession | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== "string" || typeof s.name !== "string") return null;
  if (!s.name.trim()) return null;
  if (typeof s.weekId !== "string" || !isValidWeekId(s.weekId) || !isIsoDay(s.day)) {
    return null;
  }
  const typeRaw = typeof s.type === "string" ? s.type : "other";
  const type: SessionType = isSessionType(typeRaw) ? typeRaw : "other";
  const time =
    s.time === null || s.time === undefined
      ? null
      : typeof s.time === "string" && isValidTime(s.time)
        ? s.time
        : typeof s.time === "string"
          ? ("invalid" as const)
          : null;
  if (time === "invalid") return null;
  const durationMinutes =
    s.durationMinutes === null || s.durationMinutes === undefined
      ? null
      : typeof s.durationMinutes === "number"
        ? s.durationMinutes
        : null;
  return {
    id: s.id,
    name: s.name,
    type,
    weekId: s.weekId,
    day: s.day,
    time,
    durationMinutes,
    notes: typeof s.notes === "string" ? s.notes : "",
    templateId: typeof s.templateId === "string" ? s.templateId : null,
    bodySnapshot: typeof s.bodySnapshot === "string" ? s.bodySnapshot : null,
  };
}

export async function readSchedule(): Promise<ScheduleFile> {
  const schedulePath = getSchedulePath();
  await mkdir(path.dirname(schedulePath), { recursive: true });
  try {
    const raw = await readFile(schedulePath, "utf8");
    const parsed = JSON.parse(raw) as { sessions?: unknown };
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.map(coerceSession).filter((s): s is ScheduledSession => s !== null)
      : [];
    return { sessions };
  } catch {
    return { sessions: [] };
  }
}

export async function writeSchedule(file: ScheduleFile): Promise<void> {
  await writeAtomic(getSchedulePath(), `${JSON.stringify(file, null, 2)}\n`);
}

export async function listSessions(): Promise<ScheduledSession[]> {
  return (await readSchedule()).sessions;
}

export async function sessionsForWeek(
  weekId: string,
): Promise<ScheduledSession[]> {
  return (await listSessions()).filter((s) => s.weekId === weekId);
}

export async function getSession(
  id: string,
): Promise<ScheduledSession | null> {
  return (await listSessions()).find((s) => s.id === id) ?? null;
}

export async function upsertSession(
  session: ScheduledSession,
): Promise<void> {
  const file = await readSchedule();
  const index = file.sessions.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    file.sessions[index] = session;
  } else {
    file.sessions.push(session);
  }
  await writeSchedule(file);
}

export async function deleteSession(id: string): Promise<void> {
  const file = await readSchedule();
  file.sessions = file.sessions.filter((s) => s.id !== id);
  await writeSchedule(file);
}

