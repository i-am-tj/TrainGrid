import Link from "next/link";
import type { RoutineSummary } from "@/lib/data/model";
import { SESSION_TYPE_LABELS, SESSION_TYPES, type SessionType } from "@/lib/domain";
import {
  applyLibraryQuery,
  libraryEmptyState,
  libraryHref,
  type LibraryQuery,
  type LibraryScope,
} from "@/lib/library/query";
import { btnPrimary, btnSecondary, TYPE_SHORT } from "@/lib/ui";

const SCOPE_TABS: Array<{ id: LibraryScope; label: string }> = [
  { id: "all", label: "All" },
  { id: "global", label: "TrainGrid" },
  { id: "mine", label: "Mine" },
];

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

const tab =
  "inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

export function RoutineList({
  routines,
  query,
}: {
  routines: RoutineSummary[];
  query: LibraryQuery;
}) {
  const visible = applyLibraryQuery(routines, query);
  const empty = libraryEmptyState(routines, query, visible);

  return (
    <div>
      <nav aria-label="Library view" className="inline-flex rounded-lg border border-line bg-card p-1">
        <ul className="flex gap-1">
          {SCOPE_TABS.map((s) => {
            const active = query.scope === s.id;
            return (
              <li key={s.id}>
                <Link
                  href={libraryHref(query, { scope: s.id })}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`${tab} ${
                    active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          {visible.length === 1 ? "1 routine" : `${visible.length} routines`}
        </p>
        {query.scope === "mine" && empty !== "no-own-routines" ? (
          <Link href="/library/new" className={btnPrimary}>
            New routine
          </Link>
        ) : null}
      </div>

      {empty === "no-own-routines" ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="text-sm text-stone-700">You haven&apos;t created any routines yet.</p>
          <p className="mt-1 text-sm text-stone-600">
            Routines you create are only visible to you.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/library/new" className={btnPrimary}>
              New routine
            </Link>
            <Link href={libraryHref(query, { scope: "global", type: "all" })} className={btnSecondary}>
              Browse TrainGrid routines
            </Link>
          </div>
        </div>
      ) : empty === "no-matches" ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-card px-4 py-10 text-center">
          <p className="text-sm text-stone-700">
            No {SCOPE_NOUN[query.scope]} in {query.type === "all" ? "this view" : SESSION_TYPE_LABELS[query.type]}.
          </p>
          <div className="mt-4">
            <Link href={libraryHref(query, { type: "all" })} className={btnSecondary}>
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

      {query.scope === "all" ? (
        <div className="mt-6">
          <Link href="/library/new" className={btnPrimary}>
            New routine
          </Link>
        </div>
      ) : null}
    </div>
  );
}

const GROUPS: SessionType[] = ["running", "strength", "plyometrics", "other"];

function RoutineGroups({ routines }: { routines: RoutineSummary[] }) {
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
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                  <Link href={`/library/${r.id}`} className="min-w-0">
                    <div className="font-medium">
                      {r.name}
                      <SourceLabel routine={r} />
                    </div>
                    <div className="text-xs text-stone-500">
                      {TYPE_SHORT[r.category]}
                      {r.description ? ` · ${r.description}` : ""}
                    </div>
                  </Link>
                  <Link
                    href={`/week/current/add?routine=${r.id}`}
                    className={btnSecondary}
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

/** Says, in text, whether a routine is shared or the member's own (E2-01). */
function SourceLabel({ routine }: { routine: RoutineSummary }) {
  return routine.isOwn ? (
    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
      Mine
    </span>
  ) : (
    <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
      TrainGrid
    </span>
  );
}
