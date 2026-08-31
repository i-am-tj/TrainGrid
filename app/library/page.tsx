import { TemplateList } from "@/components/library/TemplateList";
import { isSessionType, type SessionType } from "@/lib/domain";
import { listTemplates } from "@/lib/templates";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const filter: "all" | SessionType =
    type && isSessionType(type) ? type : "all";
  const templates = await listTemplates();

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Library</h1>
      <p className="mt-1 text-sm text-stone-600">
        Reusable session templates. Schedule them onto any week from here or
        from the planner.
      </p>
      <div className="mt-6">
        <TemplateList templates={templates} filter={filter} />
      </div>
    </div>
  );
}
