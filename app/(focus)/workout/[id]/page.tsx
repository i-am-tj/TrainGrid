import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { WorkoutPlayer } from "@/components/workout/WorkoutPlayer";
import { SESSION_TYPE_LABELS } from "@/lib/domain";
import { memberData } from "@/lib/data/server";
import { getSession } from "@/lib/data/sessions";
import { getWorkoutLog, recentPerformances } from "@/lib/data/workouts";
import { datesOfWeek, formatLongDay } from "@/lib/week";
import { exerciseKey, planExercise, type PreviousPerformance } from "@/lib/workouts/model";

export const metadata: Metadata = {
  title: "Workout · TrainGrid",
  robots: { index: false, follow: false },
};

// Edge to edge on phones with a notch; the screen pads itself with the safe areas.
export const viewport: Viewport = { viewportFit: "cover" };

/**
 * The live workout for one of the member's sessions. Members only
 * (memberData); the session, its log and the member's history are all read
 * as the member under Row Level Security.
 */
export default async function WorkoutPage({ params }: PageProps<"/workout/[id]">) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const session = await getSession(db, userId, id);
  if (!session) notFound();

  const [log, history] = await Promise.all([
    getWorkoutLog(db, userId, session.id),
    // "Last time" is a nicety: the workout still opens without it.
    recentPerformances(db, userId, session.id).catch(() => new Map<string, PreviousPerformance>()),
  ]);

  const exercises = session.items.map((item) => planExercise(item, session.category));
  const previous: Record<string, PreviousPerformance> = {};
  for (const exercise of exercises) {
    const found = history.get(exerciseKey(exercise.name));
    if (found) previous[exercise.itemId] = found;
  }
  // A free-form workout's exercises are named as they are added, so it gets
  // "last time" by name instead.
  const freeForm = exercises.length === 0;
  const previousByName: Record<string, PreviousPerformance> = freeForm ? Object.fromEntries(history) : {};
  const quick = session.origin === "quick";
  const date = datesOfWeek(session.weekId)[session.day - 1]!;

  return (
    <WorkoutPlayer
      session={{
        id: session.id,
        name: session.name,
        categoryLabel: SESSION_TYPE_LABELS[session.category],
        category: session.category,
        dateLabel: formatLongDay(date),
        // A discarded quick workout no longer exists, so its way out is Home.
        backHref: quick ? "/home" : `/session/${session.id}`,
        quick,
        freeForm,
      }}
      exercises={exercises}
      log={log}
      previous={previous}
      previousByName={previousByName}
    />
  );
}
