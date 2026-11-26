import { notFound } from "next/navigation";
import { CustomizeForm } from "@/components/session/CustomizeForm";
import { memberData } from "@/lib/data/server";
import { getSession } from "@/lib/data/sessions";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Edit exercises");

export default async function CustomizeSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const session = await getSession(db, userId, id);
  if (!session) notFound();

  return (
    <div className="workout-body mx-auto max-w-2xl px-3 py-7 sm:px-4 sm:py-10">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">Customize content</h1>
      <p className="mt-2 text-sm leading-7 text-stone-600">
        Changes the workout of this session only. Its routine and other sessions are not affected.
      </p>
      <div className="mt-6">
        <CustomizeForm id={session.id} items={session.items} />
      </div>
    </div>
  );
}
