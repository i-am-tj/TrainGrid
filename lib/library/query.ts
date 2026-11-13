import { z } from "zod";
import type { RoutineSummary } from "@/lib/data/model";
import { SESSION_TYPES, type SessionType } from "@/lib/domain";

/**
 * The library's URL state (E2-D09). Pure and framework-free.
 *
 *   /library                          All (default)
 *   /library?scope=global             TrainGrid: GLOBAL routines only
 *   /library?scope=mine               Mine: the member's own PERSONAL routines only
 *   /library?scope=global&type=strength
 *
 * Unknown or malformed values fall back to the default for that parameter
 * only; nothing throws and nothing is echoed back. Step 03 adds `q` and
 * `equipment` to the same contract.
 */

export const LIBRARY_SCOPES = ["all", "global", "mine"] as const;
export type LibraryScope = (typeof LIBRARY_SCOPES)[number];

export type LibraryQuery = {
  scope: LibraryScope;
  /** "all" means no category filter. */
  type: "all" | SessionType;
};

export const DEFAULT_LIBRARY_QUERY: LibraryQuery = { scope: "all", type: "all" };

type RawParams = Record<string, string | string[] | undefined>;

/** The first value of a parameter; repeated parameters use the first. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const scopeSchema = z.enum(LIBRARY_SCOPES);
const typeSchema = z.enum(SESSION_TYPES);

export function parseLibraryQuery(params: RawParams): LibraryQuery {
  const scope = scopeSchema.safeParse(first(params.scope)?.trim().toLowerCase());
  const type = typeSchema.safeParse(first(params.type)?.trim().toLowerCase());
  return {
    scope: scope.success ? scope.data : DEFAULT_LIBRARY_QUERY.scope,
    type: type.success ? type.data : DEFAULT_LIBRARY_QUERY.type,
  };
}

/** A canonical `/library` URL; default values are omitted so links stay short and stable. */
export function libraryHref(query: LibraryQuery, change: Partial<LibraryQuery> = {}): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.scope !== "all") params.set("scope", next.scope);
  if (next.type !== "all") params.set("type", next.type);
  const search = params.toString();
  return search ? `/library?${search}` : "/library";
}

export function inScope(routine: RoutineSummary, scope: LibraryScope): boolean {
  if (scope === "global") return routine.scope === "GLOBAL";
  if (scope === "mine") return routine.isOwn;
  // All: everything the member can see — GLOBAL and their own (RLS already excludes others').
  return routine.scope === "GLOBAL" || routine.isOwn;
}

export function applyLibraryQuery(routines: RoutineSummary[], query: LibraryQuery): RoutineSummary[] {
  return routines.filter(
    (routine) =>
      inScope(routine, query.scope) && (query.type === "all" || routine.category === query.type),
  );
}

/**
 * Which empty state to show. "Nothing in this view at all" and "the filters
 * matched nothing" are different messages (E2-D14): the second must not
 * claim the library is empty.
 */
export type LibraryEmptyState = "none" | "no-own-routines" | "no-routines" | "no-matches";

export function libraryEmptyState(
  routines: RoutineSummary[],
  query: LibraryQuery,
  visible: RoutineSummary[],
): LibraryEmptyState {
  if (visible.length > 0) return "none";
  const inView = routines.filter((routine) => inScope(routine, query.scope));
  if (inView.length > 0) return "no-matches";
  return query.scope === "mine" ? "no-own-routines" : "no-routines";
}
