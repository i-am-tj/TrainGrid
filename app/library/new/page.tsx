import { RoutineEditor } from "@/components/library/RoutineEditor";
import { memberData } from "@/lib/data/server";

export default async function NewRoutinePage() {
  await memberData();
  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">New routine</h1>
      <p className="mt-1 text-sm text-stone-600">Only you can see the routines you create.</p>
      <div className="mt-6">
        <RoutineEditor routine={null} />
      </div>
    </div>
  );
}
