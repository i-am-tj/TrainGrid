import { z } from "zod";
import type { LibraryRoutine, RoutineSummary } from "@/lib/data/model";
import { EQUIPMENT_TYPES, SESSION_TYPES, type EquipmentType, type SessionType } from "@/lib/domain";

/**
 * The library's URL state (E2-D09). Pure and framework-free.
 *
 *   /library                                   All (default)
 *   /library?scope=global                      TrainGrid: GLOBAL routines only
 *   /library?scope=mine                        Mine: the member's own PERSONAL routines only
 *   /library?scope=global&q=lower&type=strength&equipment=barbell
 *
 * Unknown or malformed values fall back to the default for that parameter
 * only; nothing throws and nothing is echoed back unescaped.
 */

export const LIBRARY_SCOPES = ["all", "global", "mine"] as const;
export type LibraryScope = (typeof LIBRARY_SCOPES)[number];

export const MAX_SEARCH_LENGTH = 100;

export type LibraryQuery = {
  scope: LibraryScope;
  /** Normalised search text; "" means no search. */
  q: string;
  /** "all" means no category filter. */
  type: "all" | SessionType;
  /** "all" means no equipment filter. Single-select (E2-D08). */
  equipment: "all" | EquipmentType;
};

export const DEFAULT_LIBRARY_QUERY: LibraryQuery = {
  scope: "all",
  q: "",
  type: "all",
  equipment: "all",
};

type RawParams = Record<string, string | string[] | undefined>;

/** The first value of a parameter; repeated parameters use the first. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const scopeSchema = z.enum(LIBRARY_SCOPES);
const typeSchema = z.enum(SESSION_TYPES);
const equipmentSchema = z.enum(EQUIPMENT_TYPES);

/**
 * Search text as matched and as shown: control characters removed, runs of
 * whitespace collapsed to one space, trimmed, at most 100 characters.
 * Letter case is kept for display; matching ignores it.
 */
export function normalizeSearch(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .trim();
}

export function parseLibraryQuery(params: RawParams): LibraryQuery {
  const scope = scopeSchema.safeParse(first(params.scope)?.trim().toLowerCase());
  const type = typeSchema.safeParse(first(params.type)?.trim().toLowerCase());
  const equipment = equipmentSchema.safeParse(first(params.equipment)?.trim().toLowerCase());
  return {
    scope: scope.success ? scope.data : DEFAULT_LIBRARY_QUERY.scope,
    q: normalizeSearch(first(params.q)),
    type: type.success ? type.data : DEFAULT_LIBRARY_QUERY.type,
    equipment: equipment.success ? equipment.data : DEFAULT_LIBRARY_QUERY.equipment,
  };
}

/** A canonical `/library` URL; default values are omitted so links stay short and stable. */
export function libraryHref(query: LibraryQuery, change: Partial<LibraryQuery> = {}): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.scope !== "all") params.set("scope", next.scope);
  const q = normalizeSearch(next.q);
  if (q) params.set("q", q);
  if (next.type !== "all") params.set("type", next.type);
  if (next.equipment !== "all") params.set("equipment", next.equipment);
  const search = params.toString();
  return search ? `/library?${search}` : "/library";
}

/** Whether search, category or equipment narrows the view (scope is not a filter). */
export function hasFilters(query: LibraryQuery): boolean {
  return query.q !== "" || query.type !== "all" || query.equipment !== "all";
}

export function inScope(routine: RoutineSummary, scope: LibraryScope): boolean {
  if (scope === "global") return routine.scope === "GLOBAL";
  if (scope === "mine") return routine.isOwn;
  // All: everything the member can see — GLOBAL and their own (RLS already excludes others').
  return routine.scope === "GLOBAL" || routine.isOwn;
}

/**
 * Search rule: every word of the query must appear, ignoring case, in the
 * routine's name, description or the name of any of its workout items.
 * "back squat" therefore finds a routine whose item is "Back Squat".
 */
export function matchesSearch(routine: LibraryRoutine, q: string): boolean {
  const words = normalizeSearch(q).toLocaleLowerCase("en").split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [routine.name, routine.description, ...routine.itemNames]
    .join("\n")
    .toLocaleLowerCase("en");
  return words.every((word) => haystack.includes(word));
}

function byName(a: LibraryRoutine, b: LibraryRoutine): number {
  return (
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
    a.name.localeCompare(b.name, "en") ||
    a.id.localeCompare(b.id)
  );
}

/** Scope, then search, category and equipment (all must hold); sorted by name. */
export function applyLibraryQuery(routines: LibraryRoutine[], query: LibraryQuery): LibraryRoutine[] {
  return routines
    .filter(
      (routine) =>
        inScope(routine, query.scope) &&
        (query.type === "all" || routine.category === query.type) &&
        (query.equipment === "all" || routine.equipment.includes(query.equipment)) &&
        matchesSearch(routine, query.q),
    )
    .sort(byName);
}

/**
 * Which empty state to show. "Nothing in this view at all" and "the filters
 * matched nothing" are different messages (E2-D14): the second must not
 * claim the library is empty.
 */
export type LibraryEmptyState = "none" | "no-own-routines" | "no-routines" | "no-matches";

export function libraryEmptyState(
  routines: LibraryRoutine[],
  query: LibraryQuery,
  visible: LibraryRoutine[],
): LibraryEmptyState {
  if (visible.length > 0) return "none";
  const inView = routines.filter((routine) => inScope(routine, query.scope));
  if (inView.length > 0) return "no-matches";
  return query.scope === "mine" ? "no-own-routines" : "no-routines";
}
