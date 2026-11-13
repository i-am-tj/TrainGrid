import { itemFromRow, routineFromRow, routineItemsForRpc } from "./mappers";
import { equipmentUsed } from "@/lib/library/summary";
import { DataError, type Db, type LibraryRoutine, type Routine, type RoutineSummary } from "./model";
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

/** Upper bound on routines read for the library list (E2-D07). */
export const LIBRARY_ROUTINE_LIMIT = 500;

/**
 * Everything the library list, its search and its filters need, in ONE
 * request: the member's visible routines with each routine's item names and
 * equipment embedded (no per-routine queries). RLS applies to the routines
 * and to the embedded items; the user-id filter narrows it again.
 *
 * Bounded: GLOBAL routines first, then the member's own, at most `limit`.
 * `truncated` says whether more existed, so the page can say so.
 */
export async function listLibraryRoutines(
  db: Db,
  userId: string,
  { limit = LIBRARY_ROUTINE_LIMIT }: { limit?: number } = {},
): Promise<{ routines: LibraryRoutine[]; truncated: boolean }> {
  const { data, error } = await db
    .from("routines")
    .select(`${ROUTINE_COLUMNS}, workout_items(name, equipment)`)
    .or(`scope.eq.GLOBAL,owner_user_id.eq.${userId}`)
    .order("scope")
    .order("name")
    .limit(limit + 1);
  if (error) throw new Error("Could not load routines.");

  const rows = data.slice(0, limit);
  const routines = rows.map(({ workout_items: items, ...row }) => ({
    ...routineFromRow(row, userId),
    itemNames: items.map((item) => item.name),
    equipment: equipmentUsed(items),
    itemCount: items.length,
  }));
  return { routines, truncated: data.length > limit };
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
 * Copies a GLOBAL routine into the caller's own library (E2-04) and returns
 * the new routine's id.
 *
 * The source is loaded with the caller's own client, so Row Level Security
 * decides what they can see, and it must be GLOBAL: a guessed id of another
 * member's routine, of the caller's own routine, an invalid id or a
 * non-member all get "not found", and nothing is created. Nothing about the
 * copy comes from the request except the source id.
 *
 * The copy has the source's exact name, category, description and ordered
 * items (E2-D10), scope PERSONAL, the caller as owner and no slug. Items are
 * passed without ids, so every routine and item id is new. It is saved by
 * save_personal_routine() in one transaction: a failed copy leaves nothing.
 */
export async function copyGlobalRoutine(db: Db, userId: string, rawSourceId: unknown): Promise<string> {
  const id = idSchema.safeParse(rawSourceId);
  if (!id.success) throw new DataError("not_found", "Routine not found.");

  const { data, error } = await db
    .from("routines")
    .select(`${ROUTINE_COLUMNS}, workout_items(${ITEM_COLUMNS}, sort_order)`)
    .eq("id", id.data)
    .eq("scope", "GLOBAL")
    .order("sort_order", { referencedTable: "workout_items" })
    .maybeSingle();
  if (error) throw new Error("Could not load the routine.");
  if (!data) throw new DataError("not_found", "Routine not found.");

  const { workout_items: rows, ...row } = data;
  const source = routineFromRow(row, userId);
  if (source.scope !== "GLOBAL") throw new DataError("not_found", "Routine not found.");

  return savePersonalRoutine(db, null, {
    name: source.name,
    category: source.category,
    description: source.description,
    items: rows.map(itemFromRow).map((item) => ({
      name: item.name,
      instruction: item.instruction,
      rest: item.rest,
      target: item.target,
      notes: item.notes,
      equipment: item.equipment,
      videoUrl: item.videoUrl,
    })),
  });
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
