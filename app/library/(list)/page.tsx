import type { Metadata } from "next";
import { RoutineList } from "@/components/library/RoutineList";
import { listLibraryRoutines } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import { parseLibraryQuery } from "@/lib/library/query";

export const metadata: Metadata = { title: "Library · TrainGrid" };

/** The library body; the heading and view control are in the (list) layout. */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, userId } = await memberData();
  const query = parseLibraryQuery(await searchParams);
  const { routines, truncated } = await listLibraryRoutines(db, userId);

  return <RoutineList routines={routines} query={query} truncated={truncated} />;
}
