import Link from "next/link";
import type { SessionTemplate, SessionType } from "@/lib/domain";
import { TYPE_SHORT } from "@/lib/ui";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const FILTERS: Array<{ id: "all" | SessionType; label: string }> = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "strength", label: "Strength" },
  { id: "mobility", label: "Mobility" },
  { id: "other", label: "Other" },
];

export function TemplateList({
  templates,
  filter,
}: {
  templates: SessionTemplate[];
  filter: "all" | SessionType;
}) {
  const visible =
    filter === "all" ? templates : templates.filter((t) => t.type === filter);

  const groups: SessionType[] = ["running", "strength", "mobility", "other"];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/library" : `/library?type=${f.id}`}
            className={
              filter === f.id
                ? "rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white"
                : btnSecondary
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line bg-card px-3 py-10 text-center text-sm text-stone-600">
          No templates yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((type) => {
            const items = visible.filter((t) => t.type === type);
            if (items.length === 0) return null;
            return (
              <section key={type}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {type}
                </h2>
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-card">
                  {items.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"
                    >
                      <Link href={`/library/${t.id}`} className="min-w-0">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-stone-500">
                          {TYPE_SHORT[t.type]}
                          {t.description ? ` · ${t.description}` : ""}
                        </div>
                      </Link>
                      <Link
                        href={`/week/current/add?template=${t.id}`}
                        className={btnSecondary}
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
      )}

      <div className="mt-6">
        <Link href="/library/new" className={btnPrimary}>
          New template
        </Link>
      </div>
    </div>
  );
}
