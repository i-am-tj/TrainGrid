import { notFound, redirect } from "next/navigation";
import { RoutineDetail } from "@/components/library/RoutineDetail";
import { findGlobalRoutineIdBySlug, getRoutine } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";

export default async function RoutinePage({ params }: { params: Promise<{ routineId: string }> }) {
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
      <RoutineDetail routine={routine} />
    </div>
  );
}
