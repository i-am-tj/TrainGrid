import { itemFromRow, routineFromRow, routineItemsForRpc } from "./mappers";
import { DataError, type Db, type Routine, type RoutineSummary } from "./model";
import { idSchema, routineInputSchema, type RoutineInput } from "./schemas";
import { validate } from "./validate";

/**
 * Routines the signed-in user can see: every GLOBAL routine and their own
 * PERSONAL ones.
 *
 * Each function takes the caller's own client, so every query runs as that
 * user under Row Level Security, and the caller's user id, which must come
 * from the verified session (never from request input). The id is used to
 * narrow queries as well, so isolation does not rest on RLS alone.
 */

const ROUTINE_COLUMNS = "id, scope, owner_user_id, slug, name, category, description";
const ITEM_COLUMNS = "id, name, instruction, rest, target, notes, equipment, video_url";

export async function listRoutines(db: Db, userId: string): Promise<RoutineSummary[]> {
  const { data, error } = await db
    .from("routines")
    .select(ROUTINE_COLUMNS)
    .or(`scope.eq.GLOBAL,owner_user_id.eq.${userId}`)
    .order("name");
  if (error) throw new Error("Could not load routines.");
  return data.map((row) => routineFromRow(row, userId));
}

export async function getRoutine(db: Db, userId: string, rawId: unknown): Promise<Routine | null> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return null;

  const { data, error } = await db
    .from("routines")
    .select(`${ROUTINE_COLUMNS}, workout_items(${ITEM_COLUMNS}, sort_order)`)
    .eq("id", id.data)
    .or(`scope.eq.GLOBAL,owner_user_id.eq.${userId}`)
    .order("sort_order", { referencedTable: "workout_items" })
    .maybeSingle();
  if (error) throw new Error("Could not load the routine.");
  if (!data) return null;

  const { workout_items: items, ...routine } = data;
  return { ...routineFromRow(routine, userId), items: items.map(itemFromRow) };
}

/**
 * Creates (no id) or updates (id) one of the caller's PERSONAL routines,
 * replacing its items, in a single transaction. Returns the routine id.
 * GLOBAL routines and other people's routines cannot be saved.
 */
export async function savePersonalRoutine(
  db: Db,
  rawId: unknown,
  input: RoutineInput,
): Promise<string> {
  const id = rawId === null || rawId === undefined || rawId === "" ? null : validate(idSchema, rawId);
  const routine = validate(routineInputSchema, input);

  const { data, error } = await db.rpc("save_personal_routine", {
    // The generated type marks this non-null; the function treats null as "create".
    p_routine_id: id as string,
    p_name: routine.name,
    p_category: routine.category,
    p_description: routine.description,
    p_items: routineItemsForRpc(routine.items),
  });
  if (error) {
    if (error.code === "P0002") throw new DataError("not_found", "Routine not found.");
    if (error.code === "23514" || error.code === "22023") {
      throw new DataError("invalid", "The routine could not be saved.");
    }
    throw new Error("Could not save the routine.");
  }
  return data;
}

/**
 * Deletes one of the caller's PERSONAL routines. Scheduled sessions made from
 * it keep their snapshot; only their provenance link is cleared.
 */
export async function deletePersonalRoutine(db: Db, userId: string, rawId: unknown): Promise<void> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw new DataError("not_found", "Routine not found.");

  const { data, error } = await db
    .from("routines")
    .delete()
    .eq("id", id.data)
    .eq("scope", "PERSONAL")
    .eq("owner_user_id", userId)
    .select("id");
  if (error) throw new Error("Could not delete the routine.");
  if (data.length === 0) throw new DataError("not_found", "Routine not found.");
}

const LEGACY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Old links named routines by their template slug (e.g. /library/lower-a).
 * Only seeded GLOBAL routines have slugs (a database constraint forbids them
 * on PERSONAL routines), and the lookup is restricted to GLOBAL as well, so
 * it can never reveal a member's own routine. It runs as the caller, so a
 * visitor who is not a member finds nothing.
 */
export async function findGlobalRoutineIdBySlug(db: Db, raw: unknown): Promise<string | null> {
  if (typeof raw !== "string" || raw.length > 100 || !LEGACY_SLUG.test(raw)) return null;
  const { data, error } = await db
    .from("routines")
    .select("id")
    .eq("scope", "GLOBAL")
    .eq("slug", raw)
    .maybeSingle();
  if (error) throw new Error("Could not load the routine.");
  return data?.id ?? null;
}
