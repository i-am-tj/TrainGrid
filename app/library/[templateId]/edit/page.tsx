import { notFound, redirect } from "next/navigation";
import { TemplateEditor } from "@/components/library/TemplateEditor";
import { getTemplate } from "@/lib/templates";
import { isPublishedReadonly } from "@/lib/runtime";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  if (isPublishedReadonly()) redirect(`/library/${templateId}`);
  if (templateId === "new") notFound();
  const template = await getTemplate(templateId);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Edit {template.name}</h1>
      <div className="mt-6">
        <TemplateEditor template={template} />
      </div>
    </div>
  );
}
