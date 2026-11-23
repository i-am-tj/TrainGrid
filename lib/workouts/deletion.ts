import { formatVolume, summarize, type WorkoutLog } from "./model";

/**
 * What deleting one scheduled session takes with it, in the words the
 * confirmation shows. The database decides the facts: the workout log
 * cascades with its session (20261120020000_workout_logs), while a post keeps
 * its own snapshot and only loses the link (20261122000000_social).
 */
export type SessionDeletion = {
  /** The confirm button's words: names the workout too when one would go. */
  confirmLabel: string;
  /** One line per thing affected, most serious first. */
  consequences: string[];
};

export function sessionDeletion({
  name,
  dateLabel,
  log,
  fromRoutine,
}: {
  name: string;
  dateLabel: string;
  log: Pick<WorkoutLog, "status" | "entries" | "unit"> | null;
  fromRoutine: boolean;
}): SessionDeletion {
  const consequences: string[] = [];
  if (log) {
    const { setsDone, volume } = summarize(log.entries);
    const sets = `${setsDone} ${setsDone === 1 ? "set" : "sets"}`;
    const lifted = volume > 0 ? `, ${formatVolume(volume)} ${log.unit} lifted` : "";
    consequences.push(
      log.status === "completed"
        ? `Your finished workout (${sets}${lifted}) and its notes are deleted for good.`
        : `The workout you started (${sets} logged so far) is deleted for good.`,
    );
  }
  consequences.push(`${name} is removed from ${dateLabel}.`);
  consequences.push(
    "Anything you posted about it stays on your profile and in your followers’ feeds. Delete a post from the post itself.",
  );
  if (fromRoutine) consequences.push("The routine it came from stays in your library.");

  return {
    confirmLabel: log ? "Delete session and workout" : "Delete session",
    consequences,
  };
}
