import type { DashboardRoutineInput } from "@/lib/dashboard/prepare";
import { isSessionType } from "@/lib/domain";
import { equipmentUsed } from "@/lib/library/summary";
import type { Db } from "./model";

/** How many of the member's own routines the dashboard shows. */
export const DASHBOARD_ROUTINE_LIMIT = 3;

/**
 * The caller's own PERSONAL routines, most recently changed first, with what
 * the card summary needs. Runs as the member (RLS) and is narrowed to their
 * user id as well; GLOBAL routines and other members' routines never appear.
 */
export async function listOwnRoutinesForDashboard(
  db: Db,
  userId: string,
  limit = DASHBOARD_ROUTINE_LIMIT,
): Promise<DashboardRoutineInput[]> {
  const { data, error } = await db
    .from("routines")
    .select("id, name, category, workout_items(equipment)")
    .eq("scope", "PERSONAL")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw new Error("Could not load your routines.");
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    category: isSessionType(row.category) ? row.category : "other",
    itemCount: row.workout_items.length,
    equipment: equipmentUsed(row.workout_items),
  }));
}
