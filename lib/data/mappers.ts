import type { z } from "zod";
import { weekDayOfDate } from "@/lib/calendar-date";
import type { Json, Tables } from "@/lib/database.types";
import { isEquipmentType, isSessionType, type SessionType } from "@/lib/domain";
import {
  DataError,
  type PlannedItem,
  type RoutineSummary,
  type ScheduledSessionRecord,
  type SnapshotItem,
} from "./model";
import { snapshotSchema, type SnapshotDoc, type workoutItemInputSchema } from "./schemas";

/** Pure conversions between database rows and the app's types. */

type RoutineRow = Pick<
  Tables<"routines">,
  "id" | "scope" | "owner_user_id" | "slug" | "name" | "category" | "description"
>;
type ItemRow = Pick<
  Tables<"workout_items">,
  "id" | "name" | "instruction" | "rest" | "target" | "notes" | "equipment" | "video_url"
>;
type SessionRow = Pick<
  Tables<"scheduled_sessions">,
  | "id"
  | "date"
  | "start_time"
  | "name"
  | "category"
  | "duration_minutes"
  | "notes"
  | "source_routine_id"
  | "snapshot"
>;

type ParsedItem = z.output<typeof workoutItemInputSchema>;

function category(value: string): SessionType {
  return isSessionType(value) ? value : "other";
}

export function routineFromRow(row: RoutineRow, userId: string): RoutineSummary {
  return {
    id: row.id,
    scope: row.scope === "GLOBAL" ? "GLOBAL" : "PERSONAL",
    isOwn: row.scope === "PERSONAL" && row.owner_user_id === userId,
    slug: row.slug,
    name: row.name,
    category: category(row.category),
    description: row.description,
  };
}

export function itemFromRow(row: ItemRow): PlannedItem {
  return {
    id: row.id,
    name: row.name,
    instruction: row.instruction,
    rest: row.rest,
    target: row.target,
    notes: row.notes,
    equipment: row.equipment.filter(isEquipmentType),
    videoUrl: row.video_url,
  };
}

/** "07:30:00" → "07:30". */
export function startTimeFromRow(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export function parseSnapshot(value: Json): SnapshotDoc {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) throw new DataError("invalid", "Stored session content is not readable.");
  return parsed.data;
}

export function sessionFromRow(row: SessionRow): ScheduledSessionRecord {
  const { weekId, day } = weekDayOfDate(row.date);
  return {
    id: row.id,
    date: row.date,
    weekId,
    day,
    startTime: startTimeFromRow(row.start_time),
    name: row.name,
    category: category(row.category),
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    sourceRoutineId: row.source_routine_id,
    items: parseSnapshot(row.snapshot).items.map(
      (item): SnapshotItem => ({
        id: item.id,
        sourceItemId: item.source_item_id,
        name: item.name,
        instruction: item.instruction,
        rest: item.rest,
        target: item.target,
        notes: item.notes,
        equipment: item.equipment,
        videoUrl: item.video_url,
      }),
    ),
  };
}

/**
 * A snapshot copied from routine items. Every copied item gets its own new id
 * and remembers the routine item it came from (D-04B).
 */
export function snapshotFromRoutineItems(
  items: PlannedItem[],
  newId: () => string = () => crypto.randomUUID(),
): SnapshotDoc {
  return {
    version: 1,
    items: items.map((item) => ({
      id: newId(),
      source_item_id: item.id,
      name: item.name,
      instruction: item.instruction,
      rest: item.rest,
      target: item.target,
      notes: item.notes,
      equipment: [...item.equipment],
      video_url: item.videoUrl,
    })),
  };
}

/**
 * A snapshot from edited items. An item keeps its id (and provenance) only if
 * that id is already in the session's current snapshot.
 */
export function snapshotFromInputItems(
  items: ParsedItem[],
  current: SnapshotDoc = { version: 1, items: [] },
  newId: () => string = () => crypto.randomUUID(),
): SnapshotDoc {
  const existing = new Map(current.items.map((item) => [item.id, item]));
  return {
    version: 1,
    items: items.map((item) => {
      const kept = item.id ? existing.get(item.id) : undefined;
      return {
        id: kept?.id ?? newId(),
        source_item_id: kept?.source_item_id ?? null,
        name: item.name,
        instruction: item.instruction,
        rest: item.rest,
        target: item.target,
        notes: item.notes,
        equipment: item.equipment,
        video_url: item.videoUrl,
      };
    }),
  };
}

/** The snapshot as a JSON value for the database column. */
export function snapshotToJson(snapshot: SnapshotDoc): NonNullable<Json> {
  return snapshot as unknown as NonNullable<Json>;
}

/** A copy of a snapshot with fresh item ids, for Duplicate Week. */
export function copySnapshot(
  snapshot: SnapshotDoc,
  newId: () => string = () => crypto.randomUUID(),
): SnapshotDoc {
  return {
    version: 1,
    items: snapshot.items.map((item) => ({ ...item, id: newId(), equipment: [...item.equipment] })),
  };
}

/** Items in the shape save_personal_routine() expects. */
export function routineItemsForRpc(items: ParsedItem[]) {
  return items.map((item) => ({
    ...(item.id ? { id: item.id } : {}),
    name: item.name,
    instruction: item.instruction,
    rest: item.rest,
    target: item.target,
    notes: item.notes,
    equipment: item.equipment,
    video_url: item.videoUrl,
  }));
}
