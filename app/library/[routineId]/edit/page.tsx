import { notFound, redirect } from "next/navigation";
import { RoutineEditor } from "@/components/library/RoutineEditor";
import { findGlobalRoutineIdBySlug, getRoutine } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const { db, userId } = await memberData();
  const { routineId } = await params;
  const routine = await getRoutine(db, userId, routineId);
  if (!routine) {
    // Legacy /library/<slug>/edit: seeded routines are read-only, so show the routine.
    const legacyId = await findGlobalRoutineIdBySlug(db, routineId);
    if (legacyId) redirect(`/library/${legacyId}`);
  }
  // Only the member's own routines can be edited; shared ones are read-only.
  if (!routine || !routine.isOwn) notFound();

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Edit {routine.name}</h1>
      <div className="mt-6">
        <RoutineEditor routine={routine} />
      </div>
    </div>
  );
}
