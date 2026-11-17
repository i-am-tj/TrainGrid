import { notFound } from "next/navigation";
import { EditSessionForm } from "@/components/session/EditSessionForm";
import { memberData } from "@/lib/data/server";
import { getSession } from "@/lib/data/sessions";

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const session = await getSession(db, userId, id);
  if (!session) notFound();

  return (
    <div className="workout-body mx-auto max-w-2xl px-3 py-7 sm:px-4 sm:py-10">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">Edit session</h1>
      <p className="mt-2 text-sm leading-7 text-stone-600">
        Changes the day, time, name or notes of this session only.
      </p>
      <div className="mt-6">
        <EditSessionForm session={session} />
      </div>
    </div>
  );
}
