import { RoutineEditor } from "@/components/library/RoutineEditor";
import { memberData } from "@/lib/data/server";

export default async function NewRoutinePage() {
  await memberData();
  return (
    <div className="workout-body mx-auto max-w-2xl px-3 py-7 sm:px-4 sm:py-10">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">New routine</h1>
      <p className="mt-2 text-sm leading-7 text-stone-600">Only you can see the routines you create.</p>
      <div className="mt-6">
        <RoutineEditor routine={null} />
      </div>
    </div>
  );
}
