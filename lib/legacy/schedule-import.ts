import { dateOfWeekDay, isRealWeekId } from "../calendar-date";
import type { SnapshotDoc } from "../data/schemas";
import { isSessionType, type IsoDay, type SessionType } from "../domain";
import { convertBody, convertSection } from "../seed/convert-template";
import { isValidTime } from "../week";

/**
 * One-time import of a file-era schedule (data/schedule.json) into one
 * member's scheduled sessions (story 16). Pure conversion; the script in
 * scripts/import-legacy-schedule.ts does the I/O.
 *
 * Every imported session becomes a snapshot (D-03):
 *   - a session with its own copied body keeps that content;
 *   - a session that followed a template gets a copy of the matching GLOBAL
 *     routine as it is now (matched by template slug).
 */

export type LegacySession = {
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

export type RoutineForImport = {
  id: string;
  slug: string;
  items: Array<{
    id: string;
    name: string;
    instruction: string;
    rest: string;
    target: string;
    notes: string;
    equipment: string[];
    video_url: string | null;
  }>;
};

export type SessionRow = {
  id: string;
  user_id: string;
  date: string;
  start_time: string | null;
  name: string;
  category: SessionType;
  duration_minutes: number | null;
  notes: string;
  source_routine_id: string | null;
  snapshot: SnapshotDoc;
};

export type ImportPlan = { rows: SessionRow[]; warnings: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Reads the old file format. Throws on anything malformed rather than guessing. */
export function parseLegacySchedule(text: string): LegacySession[] {
  const raw = JSON.parse(text) as { sessions?: unknown };
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.sessions)) {
    throw new Error('Expected a JSON object with a "sessions" array.');
  }
  return raw.sessions.map((item, index) => {
    const s = (item ?? {}) as Record<string, unknown>;
    const fail = (why: string) => {
      throw new Error(`Session ${index + 1}: ${why}`);
    };
    if (typeof s.id !== "string" || !s.id) fail("missing id");
    if (typeof s.name !== "string" || !s.name.trim()) fail("missing name");
    if (typeof s.weekId !== "string" || !isRealWeekId(s.weekId)) fail("invalid weekId");
    if (typeof s.day !== "number" || !Number.isInteger(s.day) || s.day < 1 || s.day > 7) fail("invalid day");
    const time = s.time ?? null;
    if (time !== null && (typeof time !== "string" || !isValidTime(time))) fail("invalid time");
    const type = typeof s.type === "string" && isSessionType(s.type) ? s.type : "other";
    const duration =
      typeof s.durationMinutes === "number" && Number.isInteger(s.durationMinutes) && s.durationMinutes > 0
        ? s.durationMinutes
        : null;
    return {
      id: s.id as string,
      name: (s.name as string).trim().slice(0, 200),
      type,
      weekId: s.weekId as string,
      day: s.day as IsoDay,
      time: time as string | null,
      durationMinutes: duration,
      notes: typeof s.notes === "string" ? s.notes.slice(0, 4000) : "",
      templateId: typeof s.templateId === "string" && s.templateId ? s.templateId : null,
      bodySnapshot: typeof s.bodySnapshot === "string" ? s.bodySnapshot : null,
    };
  });
}

function itemsFromBody(name: string, body: string, newId: () => string): SnapshotDoc["items"] {
  const sections = convertBody("legacy", body);
  const items =
    sections.length > 0
      ? sections
      : body.trim()
        ? [convertSection("legacy", 0, name, body)]
        : [];
  return items.map((item) => ({
    id: newId(),
    source_item_id: null,
    name: item.name,
    instruction: item.instruction,
    rest: item.rest,
    target: item.target,
    notes: item.notes,
    equipment: item.equipment,
    video_url: item.videoUrl,
  }));
}

export function planImport(
  sessions: LegacySession[],
  userId: string,
  routines: RoutineForImport[],
  newId: () => string = () => crypto.randomUUID(),
): ImportPlan {
  if (!isUuid(userId)) throw new Error("The target user id must be a UUID.");
  const bySlug = new Map(routines.map((routine) => [routine.slug, routine]));
  const warnings: string[] = [];

  const rows = sessions.map((session): SessionRow => {
    const routine = session.templateId ? bySlug.get(session.templateId) : undefined;
    // Only a problem when the session relied on the template for its content.
    if (session.templateId && !routine && session.bodySnapshot === null) {
      warnings.push(
        `"${session.name}" (${session.weekId} day ${session.day}): template "${session.templateId}" has no GLOBAL routine; imported with no workout items.`,
      );
    }

    let items: SnapshotDoc["items"];
    if (session.bodySnapshot !== null) {
      items = itemsFromBody(session.name, session.bodySnapshot, newId);
    } else if (routine) {
      items = routine.items.map((item) => ({
        id: newId(),
        source_item_id: item.id,
        name: item.name,
        instruction: item.instruction,
        rest: item.rest,
        target: item.target,
        notes: item.notes,
        equipment: item.equipment as SnapshotDoc["items"][number]["equipment"],
        video_url: item.video_url,
      }));
    } else {
      items = [];
    }

    let id = session.id;
    if (!isUuid(id)) {
      id = newId();
      warnings.push(`"${session.name}": old id is not a UUID; a re-run would import it again.`);
    }

    return {
      id,
      user_id: userId,
      date: dateOfWeekDay(session.weekId, session.day),
      start_time: session.time,
      name: session.name,
      category: session.type,
      duration_minutes: session.durationMinutes,
      notes: session.notes,
      source_routine_id: routine?.id ?? null,
      snapshot: { version: 1, items },
    };
  });

  return { rows, warnings };
}
