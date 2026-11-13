import Link from "next/link";
import type { LibraryRoutine } from "@/lib/data/model";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  SESSION_TYPE_LABELS,
  SESSION_TYPES,
  type SessionType,
} from "@/lib/domain";
import {
  applyLibraryQuery,
  DEFAULT_LIBRARY_QUERY,
  hasFilters,
  libraryEmptyState,
  libraryHref,
  MAX_SEARCH_LENGTH,
  type LibraryQuery,
  type LibraryScope,
} from "@/lib/library/query";
import { routineAtAGlance } from "@/lib/library/summary";
import { btnPrimary, btnSecondary, fieldClass, TYPE_SHORT } from "@/lib/ui";
import { SourceLabel } from "./SourceLabel";

const CATEGORY_FILTERS: Array<{ id: "all" | SessionType; label: string }> = [
  // Not just "All": the view tabs above already have an "All".
  { id: "all", label: "All types" },
  ...SESSION_TYPES.map((id) => ({ id, label: SESSION_TYPE_LABELS[id] })),
];

const SCOPE_NOUN: Record<LibraryScope, string> = {
  all: "routines",
  global: "TrainGrid routines",
  mine: "routines of your own",
};

/** "matching “lower” in Strength with Barbell" — only the parts that are set. */
function describeFilters(query: LibraryQuery): string {
  const parts: string[] = [];
  if (query.q) parts.push(`matching “${query.q}”`);
  if (query.type !== "all") parts.push(`in ${SESSION_TYPE_LABELS[query.type]}`);
  if (query.equipment !== "all") parts.push(`with ${EQUIPMENT_LABELS[query.equipment]}`);
  return parts.length > 0 ? parts.join(" ") : "in this view";
}

export function RoutineList({
  routines,
  query,
  truncated = false,
}: {
  routines: LibraryRoutine[];
  query: LibraryQuery;
  truncated?: boolean;
}) {
  const visible = applyLibraryQuery(routines, query);
  const empty = libraryEmptyState(routines, query, visible);
  const filtered = hasFilters(query);
  const clearHref = libraryHref({ ...DEFAULT_LIBRARY_QUERY, scope: query.scope });

  return (
    <div>
      <form
        method="get"
        action="/library"
        role="search"
        aria-label="Search the library"
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        {query.scope !== "all" ? <input type="hidden" name="scope" value={query.scope} /> : null}
        {query.type !== "all" ? <input type="hidden" name="type" value={query.type} /> : null}
        <label className="block text-sm font-medium sm:flex-1">
          Search routines
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            maxLength={MAX_SEARCH_LENGTH}
            placeholder="Name, description or exercise"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-medium sm:w-48">
          Equipment
          <select name="equipment" defaultValue={query.equipment === "all" ? "" : query.equipment} className={fieldClass}>
            <option value="">Any equipment</option>
            {EQUIPMENT_TYPES.map((tag) => (
              <option key={tag} value={tag}>
                {EQUIPMENT_LABELS[tag]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btnPrimary}>
          Search
        </button>
      </form>

      <nav aria-label="Category" className="mt-3">
        <ul className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((f) => {
            const active = query.type === f.id;
            return (
              <li key={f.id}>
                <Link
                  href={libraryHref(query, { type: f.id })}
                  scroll={false}
                  className={active ? btnPrimary : btnSecondary}
                  aria-current={active ? "page" : undefined}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
        <p className="text-sm text-stone-600" aria-live="polite">
          {visible.length === 1 ? "1 routine" : `${visible.length} routines`}
          {filtered ? (
            <>
              {" · "}
              <Link href={clearHref} className="underline underline-offset-2 hover:text-stone-900">
                Clear filters
              </Link>
            </>
          ) : null}
        </p>
        {/* Always creates a PERSONAL routine, whichever view is open. */}
        <Link href="/library/new" className={`${btnSecondary} gap-1.5`}>
          <PlusIcon />
          New routine
        </Link>
      </div>

      {empty === "no-own-routines" ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="text-sm text-stone-700">You haven&apos;t created any routines yet.</p>
          <p className="mt-1 text-sm text-stone-600">
            Use New routine above to make one. Routines you create are only visible to you.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href={libraryHref(query, { scope: "global", type: "all" })} className={btnSecondary}>
              Browse TrainGrid routines
            </Link>
          </div>
        </div>
      ) : empty === "no-matches" ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="text-sm text-stone-700">
            No {SCOPE_NOUN[query.scope]} {describeFilters(query)}.
          </p>
          <div className="mt-4">
            <Link href={clearHref} className={btnSecondary}>
              Clear filters
            </Link>
          </div>
        </div>
      ) : empty === "no-routines" ? (
        <p className="mt-4 rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center text-sm text-stone-600">
          {query.scope === "global" ? "No TrainGrid routines yet." : "No routines yet."}
        </p>
      ) : (
        <RoutineGroups routines={visible} />
      )}

      {truncated ? (
        <p className="mt-4 text-sm text-stone-600">
          Showing the first routines only. Narrow the search to find the rest.
        </p>
      ) : null}

    </div>
  );
}

const GROUPS: SessionType[] = ["running", "strength", "plyometrics", "other"];

function RoutineGroups({ routines }: { routines: LibraryRoutine[] }) {
  return (
    <div className="mt-4 space-y-6">
      {GROUPS.map((type) => {
        const items = routines.filter((r) => r.category === type);
        if (items.length === 0) return null;
        return (
          <section key={type} aria-labelledby={`group-${type}`}>
            <h2
              id={`group-${type}`}
              className="text-xs font-semibold uppercase tracking-wide text-stone-500"
            >
              {SESSION_TYPE_LABELS[type]}
            </h2>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-card">
              {items.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <Link href={`/library/${r.id}`} className="min-w-0 flex-1">
                    <div className="font-medium">
                      {r.name}
                      <SourceLabel isOwn={r.isOwn} />
                    </div>
                    <div className="text-xs text-stone-500">
                      {TYPE_SHORT[r.category]}
                      {r.description ? ` · ${r.description}` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-stone-600">
                      {routineAtAGlance(r.itemCount, r.equipment)}
                    </div>
                  </Link>
                  <Link
                    href={`/week/current/add?routine=${r.id}`}
                    className={`${btnSecondary} shrink-0`}
                    aria-label={`Schedule ${r.name}`}
                  >
                    Schedule
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}
