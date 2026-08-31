import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkoutItemsView } from "@/components/session/WorkoutItemsView";
import { getSession } from "@/lib/schedule";
import { listTemplates } from "@/lib/templates";
import { resolveSession, templatesById } from "@/lib/resolve-session";
import { datesOfWeek, formatLongDay } from "@/lib/week";
import { btnSecondary, TYPE_SHORT } from "@/lib/ui";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  const templates = await listTemplates();
  const resolved = resolveSession(session, templatesById(templates));
  const date = datesOfWeek(session.weekId)[session.day - 1]!;
  const liveLinked = resolved.source === "template";
  const template = session.templateId
    ? templates.find((t) => t.id === session.templateId)
    : null;

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <Link
        href={`/week/${session.weekId}?day=${session.day}`}
        className="text-sm text-stone-600 hover:underline"
      >
        ← Back to week
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{resolved.name}</h1>
      <p className="mt-1 text-sm text-stone-600">
        {TYPE_SHORT[resolved.type]} · {formatLongDay(date)}
        {resolved.time ? ` · ${resolved.time}` : " · no specific time"}
        {resolved.durationMinutes != null
          ? ` · ${resolved.durationMinutes}m`
          : ""}
      </p>

      {liveLinked && template ? (
        <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-950">
          Updates if you edit the template.{" "}
          <Link href={`/library/${template.id}`} className="underline">
            Open template
          </Link>
        </p>
      ) : resolved.source === "snapshot" ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          This session has its own copy of the workout.
        </p>
      ) : (
        <p className="mt-3 rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
          Not linked to a template.
        </p>
      )}

      {resolved.notes ? (
        <p className="mt-4 text-sm">
          <span className="font-medium">Notes:</span> {resolved.notes}
        </p>
      ) : null}

      <div className="mt-6 border-t border-line pt-4">
        <WorkoutItemsView markdown={resolved.body} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={`/session/${session.id}/edit`} className={btnSecondary}>
          Edit
        </Link>
        <Link
          href={`/session/${session.id}/customize`}
          className={btnSecondary}
        >
          Customize content
        </Link>
        {liveLinked && template ? (
          <Link href={`/library/${template.id}`} className={btnSecondary}>
            Open template
          </Link>
        ) : null}
      </div>
    </div>
  );
}
