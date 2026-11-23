import type { WorkoutLog } from "@/lib/workouts/model";
import { itemFromRow, sessionFromRow } from "./mappers";
import type { Db, PlannedItem, ScheduledSessionRecord } from "./model";
import { SocialUnavailableError } from "@/lib/social/availability";
import { exportSocialData, type SocialExport } from "./social";
import { logFromRow } from "./workouts";

/**
 * The signed-in user's own data, for download (D-06).
 *
 * Contains their PERSONAL routines with items, their scheduled sessions,
 * their workout logs (what they did in those sessions) and, since v4, their
 * social profile, relationships (by username) and session posts, and since
 * v5 the comments they wrote and the posts they liked.
 * It never contains GLOBAL routines, another user's data, invitations,
 * profile or auth details, or anything about the infrastructure.
 */

export type UserExport = {
  format: "traingrid-export";
  version: 5;
  exportedAt: string;
  routines: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    items: PlannedItem[];
  }>;
  sessions: ScheduledSessionRecord[];
  workoutLogs: WorkoutLog[];
  social: SocialExport;
};

export async function exportUserData(db: Db, userId: string): Promise<UserExport> {
  const [routines, sessions, logs, social] = await Promise.all([
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
    db
      .from("workout_logs")
      .select("id, session_id, status, started_at, finished_at, unit, entries, notes, updated_at")
      .eq("user_id", userId)
      .order("started_at"),
    // Before the social migration exists, the download still works, with no social data.
    exportSocialData(db, userId).catch((error: unknown): SocialExport => {
      if (error instanceof SocialUnavailableError) return { profile: null, following: [], followers: [], posts: [], comments: [], likes: [] };
      throw error;
    }),
  ]);
  if (routines.error || sessions.error || logs.error) throw new Error("Could not export your data.");

  return {
    format: "traingrid-export",
    version: 5,
    exportedAt: new Date().toISOString(),
    routines: routines.data.map(({ workout_items: items, ...routine }) => ({
      ...routine,
      items: items.map(itemFromRow),
    })),
    sessions: sessions.data.map(sessionFromRow),
    workoutLogs: logs.data.map(logFromRow),
    social,
  };
}
