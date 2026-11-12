import { RoutineList } from "@/components/library/RoutineList";
import { listRoutines } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import { isSessionType, type SessionType } from "@/lib/domain";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { db, userId } = await memberData();
  const { type } = await searchParams;
  const filter: "all" | SessionType = type && isSessionType(type) ? type : "all";
  const routines = await listRoutines(db, userId);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-stone-600">
        Reusable routines. Schedule them onto any week from here or from the planner.
      </p>
      <div className="mt-6">
        <RoutineList routines={routines} filter={filter} />
      </div>
    </div>
  );
}
