import { redirect } from "next/navigation";
import { TemplateEditor } from "@/components/library/TemplateEditor";
import { isPublishedReadonly } from "@/lib/runtime";
import { requireMember } from "@/lib/auth/session";

export default async function NewTemplatePage() {
  await requireMember();
  if (isPublishedReadonly()) redirect("/library");

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">New template</h1>
      <div className="mt-6">
        <TemplateEditor template={null} />
      </div>
    </div>
  );
}
