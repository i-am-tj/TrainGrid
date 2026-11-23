import { describe, expect, it } from "vitest";
import { sessionDeletion } from "./deletion";
import type { WorkoutEntries } from "./model";

const entries = (sets: WorkoutEntries["items"][number]["sets"]): WorkoutEntries => ({
  version: 1,
  items: [{ item_id: "00000000-0000-4000-8000-000000000001", name: "Squat", sets }],
});

describe("sessionDeletion", () => {
  it("names only the session, its posts and the routine when nothing was logged", () => {
    const result = sessionDeletion({ name: "Easy Run", dateLabel: "Monday 30 November", log: null, fromRoutine: true });
    expect(result.confirmLabel).toBe("Delete session");
    expect(result.consequences).toEqual([
      "Easy Run is removed from Monday 30 November.",
      "Anything you posted about it stays on your profile and in your followers’ feeds. Delete a post from the post itself.",
      "The routine it came from stays in your library.",
    ]);
  });

  it("puts a finished workout first, with what was done", () => {
    const result = sessionDeletion({
      name: "Upper",
      dateLabel: "Tuesday 24 November",
      log: {
        status: "completed",
        unit: "kg",
        entries: entries([
          { weight: 60, reps: 5, done: true },
          { weight: 60, reps: 5, done: true },
          { weight: 60, reps: 5, done: false },
        ]),
      },
      fromRoutine: false,
    });
    expect(result.confirmLabel).toBe("Delete session and workout");
    expect(result.consequences[0]).toBe("Your finished workout (2 sets, 600 kg lifted) and its notes are deleted for good.");
    expect(result.consequences).not.toContain("The routine it came from stays in your library.");
  });

  it("describes a workout still in progress", () => {
    const result = sessionDeletion({
      name: "Quick lift",
      dateLabel: "Monday 23 November",
      log: { status: "in_progress", unit: "kg", entries: entries([{ weight: null, reps: 10, done: true }]) },
      fromRoutine: false,
    });
    expect(result.consequences[0]).toBe("The workout you started (1 set logged so far) is deleted for good.");
  });
});
