import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryFilters, RoutineList } from "@/components/library/RoutineList";
import { SectionLoader } from "@/components/LogoLoader";
import type { Db } from "@/lib/data/model";
import { listLibraryRoutines } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import { libraryHref, parseLibraryQuery, type LibraryQuery } from "@/lib/library/query";

export const metadata: Metadata = { title: "Library · TrainGrid" };

/**
 * The library body; the heading and view control are in the (list) layout.
 * The results are keyed by the query, so a new search, view or filter shows
 * the section loader while the view control and form stay on screen.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, userId } = await memberData();
  const query = parseLibraryQuery(await searchParams);

  return (
    <>
      <LibraryFilters query={query} />
      <div className="mt-4">
        <Suspense key={libraryHref(query)} fallback={<SectionLoader label="Loading routines…" minHeight="min-h-80" />}>
          <LibraryResults db={db} userId={userId} query={query} />
        </Suspense>
      </div>
    </>
  );
}

async function LibraryResults({ db, userId, query }: { db: Db; userId: string; query: LibraryQuery }) {
  const { routines, truncated } = await listLibraryRoutines(db, userId);
  return <RoutineList routines={routines} query={query} truncated={truncated} />;
}
