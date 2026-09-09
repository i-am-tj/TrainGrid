import Link from "next/link";
import { ImportExport } from "@/components/ImportExport";
import { isPublishedReadonly } from "@/lib/runtime";

export function AppHeader() {
  const readonly = isPublishedReadonly();

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          TrainGrid
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm sm:gap-2">
          <Link
            href="/"
            className="rounded-md px-1.5 py-1 text-stone-700 hover:bg-stone-100 sm:px-2"
          >
            Planner
          </Link>
          <Link
            href="/library"
            className="rounded-md px-1.5 py-1 text-stone-700 hover:bg-stone-100 sm:px-2"
          >
            Library
          </Link>
          {readonly ? (
            <span className="rounded-md bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-950 sm:px-2 sm:text-xs">
              <span className="sm:hidden">Published</span>
              <span className="hidden sm:inline">Published · read-only</span>
            </span>
          ) : (
            <ImportExport />
          )}
        </nav>
      </div>
    </header>
  );
}
