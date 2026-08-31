import { TemplateEditor } from "@/components/library/TemplateEditor";

export default function NewTemplatePage() {
  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">New template</h1>
      <div className="mt-6">
        <TemplateEditor template={null} />
      </div>
    </div>
  );
}
