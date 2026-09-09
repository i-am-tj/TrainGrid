import Link from "next/link";
import { SESSION_TYPE_LABELS, type SessionTemplate } from "@/lib/domain";
import { WorkoutItemsView } from "@/components/session/WorkoutItemsView";
import { btnSecondary } from "@/lib/ui";
import { isPublishedReadonly } from "@/lib/runtime";

export function TemplateDetail({ template }: { template: SessionTemplate }) {
  const readonly = isPublishedReadonly();

  return (
    <div>
      <Link href="/library" className="text-sm text-stone-600 hover:underline">
        ← Back to Library
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{template.name}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {SESSION_TYPE_LABELS[template.type]}
            {template.description ? ` · ${template.description}` : ""}
          </p>
        </div>
        {readonly ? null : (
          <Link
            href={`/library/${template.id}/edit`}
            className={`${btnSecondary} shrink-0 gap-2 px-3`}
            aria-label="Edit template"
          >
            <PencilIcon />
            Edit
          </Link>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <WorkoutItemsView markdown={template.body} />
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343z" />
    </svg>
  );
}
