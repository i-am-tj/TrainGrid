import type { WorkoutLog } from "@/lib/workouts/model";
import { itemFromRow, sessionFromRow } from "./mappers";
import type { Db, PlannedItem, ScheduledSessionRecord } from "./model";
import { SocialUnavailableError } from "@/lib/social/availability";
import { exportSocialData, type SocialExport } from "./social";
import { PAGE_SIZE, readAllPages } from "./paging";
import { logFromRow } from "./workouts";

/**
 * The signed-in user's own data, for download (D-06).
 *
 * Contains their PERSONAL routines with items, their scheduled sessions,
 * their workout logs (what they did in those sessions) and their social
 * data: profile, relationships (by username), session posts as posted, the
 * comments they wrote and the posts they liked.
 * It never contains GLOBAL routines, another user's data, invitations,
 * profile or auth details, or anything about the infrastructure.
 *
 * Complete by construction (PRODUCT_AUDIT F5): every collection is read in
 * full, page by page in a stable order, so the Data API's row cap cannot
 * shorten it; and a section that could not be read is marked "unavailable"
 * (and is null) rather than looking empty.
 *
 * Version 6: sessions carry `origin` (planned or quick), posts carry the
 * workout totals they show, and `complete` / `sections` say what is in it.
 */

export type ExportSection = "included" | "unavailable";

export type UserExport = {
  format: "traingrid-export";
  version: 6;
  exportedAt: string;
  /** False when any section is "unavailable": the file is valid but not everything is in it. */
  complete: boolean;
  sections: {
    routines: ExportSection;
    sessions: ExportSection;
    workoutLogs: ExportSection;
    /** "unavailable" before the social migration is applied; `social` is then null. */
    social: ExportSection;
  };
  routines: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    items: PlannedItem[];
  }>;
  sessions: ScheduledSessionRecord[];
  workoutLogs: WorkoutLog[];
  social: SocialExport | null;
};

export async function exportUserData(db: Db, userId: string, { pageSize = PAGE_SIZE } = {}): Promise<UserExport> {
  const [routines, sessions, logs, social] = await Promise.all([
    readAllPages(
      (from, to) =>
        db
          .from("routines")
          .select(
            "id, name, category, description, workout_items(id, name, instruction, rest, target, notes, equipment, video_url, sort_order)",
          )
          .eq("scope", "PERSONAL")
          .eq("owner_user_id", userId)
          .order("name")
          .order("id")
          .order("sort_order", { referencedTable: "workout_items" })
          .range(from, to),
      pageSize,
    ),
    readAllPages(
      (from, to) =>
        db
          .from("scheduled_sessions")
          .select("id, date, start_time, name, category, duration_minutes, notes, source_routine_id, origin, snapshot")
          .eq("user_id", userId)
          .order("date")
          .order("start_time", { nullsFirst: true })
          .order("id")
          .range(from, to),
      pageSize,
    ),
    readAllPages(
      (from, to) =>
        db
          .from("workout_logs")
          .select("id, session_id, status, started_at, finished_at, unit, entries, notes, updated_at")
          .eq("user_id", userId)
          .order("started_at")
          .order("id")
          .range(from, to),
      pageSize,
    ),
    // Before the social migration exists, the download still works, and says social is missing.
    exportSocialData(db, userId).catch((error: unknown): null => {
      if (error instanceof SocialUnavailableError) return null;
      throw error;
    }),
  ]).catch((error: unknown) => {
    throw error instanceof Error && !("code" in error) ? error : new Error("Could not export your data.");
  });

  const sections: UserExport["sections"] = {
    routines: "included",
    sessions: "included",
    workoutLogs: "included",
    social: social ? "included" : "unavailable",
  };
  return {
    format: "traingrid-export",
    version: 6,
    exportedAt: new Date().toISOString(),
    complete: Object.values(sections).every((section) => section === "included"),
    sections,
    routines: routines.map(({ workout_items: items, ...routine }) => ({
      ...routine,
      items: items.map(itemFromRow),
    })),
    sessions: sessions.map(sessionFromRow),
    workoutLogs: logs.map(logFromRow),
    social,
  };
}
