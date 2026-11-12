import { itemFromRow, sessionFromRow } from "./mappers";
import type { Db, PlannedItem, ScheduledSessionRecord } from "./model";

/**
 * The signed-in user's own data, for download (D-06).
 *
 * Contains their PERSONAL routines with items and their scheduled sessions.
 * It never contains GLOBAL routines, another user's data, invitations,
 * profile or auth details, or anything about the infrastructure.
 */

export type UserExport = {
  format: "traingrid-export";
  version: 2;
  exportedAt: string;
  routines: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    items: PlannedItem[];
  }>;
  sessions: ScheduledSessionRecord[];
};

export async function exportUserData(db: Db, userId: string): Promise<UserExport> {
  const [routines, sessions] = await Promise.all([
    db
      .from("routines")
      .select(
        "id, name, category, description, workout_items(id, name, instruction, rest, target, notes, equipment, video_url, sort_order)",
      )
      .eq("scope", "PERSONAL")
      .eq("owner_user_id", userId)
      .order("name")
      .order("sort_order", { referencedTable: "workout_items" }),
    db
      .from("scheduled_sessions")
      .select(
        "id, date, start_time, name, category, duration_minutes, notes, source_routine_id, snapshot",
      )
      .eq("user_id", userId)
      .order("date")
      .order("start_time", { nullsFirst: true }),
  ]);
  if (routines.error || sessions.error) throw new Error("Could not export your data.");

  return {
    format: "traingrid-export",
    version: 2,
    exportedAt: new Date().toISOString(),
    routines: routines.data.map(({ workout_items: items, ...routine }) => ({
      ...routine,
      items: items.map(itemFromRow),
    })),
    sessions: sessions.data.map(sessionFromRow),
  };
}
