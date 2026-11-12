import { notFound } from "next/navigation";
import { CustomizeForm } from "@/components/session/CustomizeForm";
import { memberData } from "@/lib/data/server";
import { getSession } from "@/lib/data/sessions";

export default async function CustomizeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const session = await getSession(db, userId, id);
  if (!session) notFound();

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Customize content</h1>
      <p className="mt-1 text-sm text-stone-600">
        Changes the workout of this session only. Its routine and other sessions are not affected.
      </p>
      <div className="mt-6">
        <CustomizeForm id={session.id} items={session.items} />
      </div>
    </div>
  );
}
