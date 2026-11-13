import { Suspense } from "react";
import { LibraryHeader } from "@/components/library/LibraryHeader";

/**
 * Shared frame for /library. A layout is kept across navigations, so the
 * heading and the view control stay mounted while the list below re-renders;
 * that is what lets the view pill slide between tabs. One container sets the
 * horizontal edges for the heading, filters, toolbar and results.
 */
export default function LibraryListLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <Suspense fallback={<LibraryHeaderFallback />}>
        <LibraryHeader />
      </Suspense>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function LibraryHeaderFallback() {
  return (
    <div aria-hidden="true">
      <div className="h-7 w-28 rounded bg-stone-200" />
      <div className="mt-2 h-4 w-3/4 rounded bg-stone-200" />
      <div className="mx-auto mt-5 h-12 w-[19.5rem] rounded-full bg-stone-200" />
    </div>
  );
}
