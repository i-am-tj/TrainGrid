import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkoutItemsView } from "@/components/session/WorkoutItemsView";
import { getRoutine } from "@/lib/data/routines";
import { memberData } from "@/lib/data/server";
import { getSession } from "@/lib/data/sessions";
import { btnSecondary, TYPE_SHORT } from "@/lib/ui";
import { datesOfWeek, formatLongDay } from "@/lib/week";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const session = await getSession(db, userId, id);
  if (!session) notFound();

  const source = session.sourceRoutineId
    ? await getRoutine(db, userId, session.sourceRoutineId)
    : null;
  const date = datesOfWeek(session.weekId)[session.day - 1]!;

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <Link
        href={`/week/${session.weekId}?day=${session.day}`}
        className="text-sm text-stone-600 hover:underline"
      >
        ← Back to week
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{session.name}</h1>
      <p className="mt-1 text-sm text-stone-600">
        {TYPE_SHORT[session.category]} · {formatLongDay(date)}
        {session.startTime ? ` · ${session.startTime}` : " · no specific time"}
        {session.durationMinutes != null ? ` · ${session.durationMinutes}m` : ""}
      </p>

      <p className="mt-3 rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
        {source ? (
          <>
            Copied from{" "}
            <Link href={`/library/${source.id}`} className="underline">
              {source.name}
            </Link>
            . Changes to that routine do not affect this session.
          </>
        ) : (
          // Deleting a routine clears this link, so a one-off session and one
          // whose routine was deleted look the same here.
          "Not linked to a routine. This session has its own copy of the workout."
        )}
      </p>

      {session.notes ? (
        <p className="mt-4 whitespace-pre-line text-sm">
          <span className="font-medium">Notes:</span> {session.notes}
        </p>
      ) : null}

      <div className="mt-6 border-t border-line pt-4">
        <WorkoutItemsView items={session.items} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href={`/session/${session.id}/edit`} className={btnSecondary}>
          Edit
        </Link>
        <Link href={`/session/${session.id}/customize`} className={btnSecondary}>
          Customize content
        </Link>
      </div>
    </div>
  );
}
