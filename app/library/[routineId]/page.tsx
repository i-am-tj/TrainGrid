import { notFound, redirect } from "next/navigation";
import { RoutineDetail } from "@/components/library/RoutineDetail";
import { findGlobalRoutineIdBySlug, getRoutine } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";

export default async function RoutinePage({
  params,
  searchParams,
}: {
  params: Promise<{ routineId: string }>;
  searchParams: Promise<{ copied?: string | string[] }>;
}) {
  const { db, userId } = await memberData();
  const { routineId } = await params;
  const routine = await getRoutine(db, userId, routineId);
  if (!routine) {
    // Legacy link such as /library/lower-a → the seeded GLOBAL routine.
    const legacyId = await findGlobalRoutineIdBySlug(db, routineId);
    if (legacyId) redirect(`/library/${legacyId}`);
    notFound();
  }

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      {/* One-time confirmation after copying (E2-D10); shown only on the member's own routine. */}
      <RoutineDetail routine={routine} copied={(await searchParams).copied === "1"} />
    </div>
  );
}
