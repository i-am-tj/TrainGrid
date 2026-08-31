import { notFound } from "next/navigation";
import { EditSessionForm } from "@/components/session/EditSessionForm";
import { getSession } from "@/lib/schedule";
import { listTemplates } from "@/lib/templates";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  const templates = await listTemplates();

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Edit session</h1>
      <p className="mt-1 text-sm text-stone-600">
        Changing day, time, name, or notes does not rewrite the template file.
      </p>
      <div className="mt-6">
        <EditSessionForm session={session} templates={templates} />
      </div>
    </div>
  );
}
