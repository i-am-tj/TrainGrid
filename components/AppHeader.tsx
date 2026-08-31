import Link from "next/link";
import { ImportExport } from "@/components/ImportExport";

export function AppHeader() {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          TrainGrid
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/"
            className="rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100"
          >
            Planner
          </Link>
          <Link
            href="/library"
            className="rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100"
          >
            Library
          </Link>
          <ImportExport />
        </nav>
      </div>
    </header>
  );
}
