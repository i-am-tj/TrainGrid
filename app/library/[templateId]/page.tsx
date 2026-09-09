import { notFound } from "next/navigation";
import { TemplateDetail } from "@/components/library/TemplateDetail";
import { getTemplate } from "@/lib/templates";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  if (templateId === "new") notFound();
  const template = await getTemplate(templateId);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <TemplateDetail template={template} />
    </div>
  );
}
