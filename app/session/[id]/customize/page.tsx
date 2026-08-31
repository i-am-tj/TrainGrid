import { notFound } from "next/navigation";
import { CustomizeForm } from "@/components/session/CustomizeForm";
import { getSession } from "@/lib/schedule";
import { listTemplates } from "@/lib/templates";
import { resolveSession, templatesById } from "@/lib/resolve-session";

export default async function CustomizeSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  const templates = await listTemplates();
  const resolved = resolveSession(session, templatesById(templates));

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Customize content</h1>
      <p className="mt-1 text-sm text-stone-600">
        Saves a copy on this scheduled session. Later template edits will not
        change it. The template file is left unchanged.
      </p>
      <div className="mt-6">
        <CustomizeForm id={session.id} body={resolved.body} />
      </div>
    </div>
  );
}
