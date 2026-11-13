import type { Metadata } from "next";
import { RoutineList } from "@/components/library/RoutineList";
import { listLibraryRoutines } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import { parseLibraryQuery, type LibraryScope } from "@/lib/library/query";

export const metadata: Metadata = { title: "Library · TrainGrid" };

const INTRO: Record<LibraryScope, string> = {
  all: "Shared TrainGrid routines and your own. Schedule one onto any week, or open it to see the workout.",
  global: "Routines shared with every member. They are read-only: schedule one, or open it to see the workout.",
  mine: "Routines you created. Only you can see and edit them.",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, userId } = await memberData();
  const query = parseLibraryQuery(await searchParams);
  const { routines, truncated } = await listLibraryRoutines(db, userId);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-stone-600">{INTRO[query.scope]}</p>
      <div className="mt-5">
        <RoutineList routines={routines} query={query} truncated={truncated} />
      </div>
    </div>
  );
}
