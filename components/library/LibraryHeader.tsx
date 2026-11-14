"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { libraryHref, parseLibraryQuery, type LibraryScope } from "@/lib/library/query";

const SCOPE_TABS: Array<{ id: LibraryScope; label: string }> = [
  { id: "all", label: "All" },
  { id: "global", label: "TrainGrid" },
  { id: "mine", label: "Mine" },
];

const INTRO: Record<LibraryScope, string> = {
  all: "Shared TrainGrid routines and your own. Schedule one onto any week, or open it to see the workout.",
  global: "Routines shared with every member. They are read-only: schedule one, or open it to see the workout.",
  mine: "Routines you created. Only you can see and edit them.",
};

/**
 * Library heading, intro and the All / TrainGrid / Mine segmented control.
 *
 * It lives in the (list) layout, which persists across navigations, so the
 * same pill element is still on the page when the scope changes and can slide
 * to its new place (a CSS transform transition; no animation library). The
 * view is still plain links and URL state: it works without JavaScript, and
 * back/forward simply move the pill to whatever the URL says.
 */
export function LibraryHeader() {
  const params = useSearchParams();
  const query = parseLibraryQuery(paramsRecord(params));
  // Move the pill as soon as a tab is clicked, before the new page arrives.
  // Any URL change (the navigation landing, or back/forward) clears it, so
  // the URL is always what the pill ends up showing.
  const [pending, setPending] = useState<LibraryScope | null>(null);
  const urlKey = params.toString();
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (seenUrl !== urlKey) {
    setSeenUrl(urlKey);
    setPending(null);
  }
  const active = pending ?? query.scope;
  const index = SCOPE_TABS.findIndex((t) => t.id === active);

  const onTabClick = (scope: LibraryScope) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setPending(scope);
  };

  return (
    <header>
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-stone-600">{INTRO[query.scope]}</p>

      <nav aria-label="Library view" className="mt-5 flex justify-center">
        <ul className="relative grid grid-cols-3 rounded-full border border-line bg-stone-200/50 p-1">
          <li
            aria-hidden="true"
            data-testid="library-view-pill"
            className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full border border-line bg-card shadow-sm transition-transform duration-[225ms] ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {SCOPE_TABS.map((s) => {
            const current = query.scope === s.id;
            return (
              <li key={s.id} className="relative">
                <Link
                  prefetch={false}
                  href={libraryHref(query, { scope: s.id })}
                  scroll={false}
                  onClick={onTabClick(s.id)}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex min-h-10 w-24 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 motion-reduce:transition-none ${
                    active === s.id ? "text-stone-900" : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

/** URLSearchParams → the record shape parseLibraryQuery takes (repeated keys kept). */
function paramsRecord(params: URLSearchParams): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const key of new Set(params.keys())) record[key] = params.getAll(key);
  return record;
}
