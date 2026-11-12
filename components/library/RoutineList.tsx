import Link from "next/link";
import type { RoutineSummary } from "@/lib/data/model";
import { SESSION_TYPE_LABELS, type SessionType } from "@/lib/domain";
import { btnPrimary, btnSecondary, TYPE_SHORT } from "@/lib/ui";

const FILTERS: Array<{ id: "all" | SessionType; label: string }> = [
  { id: "all", label: "All" },
  { id: "running", label: SESSION_TYPE_LABELS.running },
  { id: "strength", label: SESSION_TYPE_LABELS.strength },
  { id: "plyometrics", label: SESSION_TYPE_LABELS.plyometrics },
  { id: "other", label: SESSION_TYPE_LABELS.other },
];

const GROUPS: SessionType[] = ["running", "strength", "plyometrics", "other"];

export function RoutineList({
  routines,
  filter,
}: {
  routines: RoutineSummary[];
  filter: "all" | SessionType;
}) {
  const visible = filter === "all" ? routines : routines.filter((r) => r.category === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/library" : `/library?type=${f.id}`}
            scroll={false}
            className={filter === f.id ? btnPrimary : btnSecondary}
            aria-current={filter === f.id ? "page" : undefined}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line bg-card px-3 py-10 text-center text-sm text-stone-600">
          No routines yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {GROUPS.map((type) => {
            const items = visible.filter((r) => r.category === type);
            if (items.length === 0) return null;
            return (
              <section key={type}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {type}
                </h2>
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-card">
                  {items.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"
                    >
                      <Link href={`/library/${r.id}`} className="min-w-0">
                        <div className="font-medium">
                          {r.name}
                          {r.isOwn ? (
                            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                              Mine
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-stone-500">
                          {TYPE_SHORT[r.category]}
                          {r.description ? ` · ${r.description}` : ""}
                        </div>
                      </Link>
                      <Link href={`/week/current/add?routine=${r.id}`} className={btnSecondary}>
                        Schedule
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link href="/library/new" className={btnPrimary}>
          New routine
        </Link>
      </div>
    </div>
  );
}
