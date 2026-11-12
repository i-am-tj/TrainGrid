import { describe, expect, it } from "vitest";
import {
  copySnapshot,
  parseSnapshot,
  routineFromRow,
  sessionFromRow,
  snapshotFromInputItems,
  snapshotFromRoutineItems,
  startTimeFromRow,
} from "./mappers";
import { DataError } from "./model";
import { workoutItemInputSchema } from "./schemas";

const ids = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};

const squat = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Back Squat",
  instruction: "4 × 5",
  rest: "2 min",
  target: "RPE 7",
  notes: "",
  equipment: ["barbell" as const],
  videoUrl: null,
};

describe("routineFromRow", () => {
  const row = {
    id: "r1",
    scope: "PERSONAL",
    owner_user_id: "me",
    slug: null,
    name: "Mine",
    category: "strength",
    description: "",
  };

  it("marks only the caller's personal routines as their own", () => {
    expect(routineFromRow(row, "me").isOwn).toBe(true);
    expect(routineFromRow(row, "someone-else").isOwn).toBe(false);
    expect(routineFromRow({ ...row, scope: "GLOBAL", owner_user_id: null }, "me").isOwn).toBe(false);
  });
});

describe("snapshots", () => {
  it("D-03: copies routine items with new ids and records where each came from", () => {
    const snapshot = snapshotFromRoutineItems([squat], ids());
    expect(snapshot).toEqual({
      version: 1,
      items: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          source_item_id: squat.id,
          name: "Back Squat",
          instruction: "4 × 5",
          rest: "2 min",
          target: "RPE 7",
          notes: "",
          equipment: ["barbell"],
          video_url: null,
        },
      ],
    });
  });

  it("does not share arrays with the source", () => {
    const source = { ...squat, equipment: [...squat.equipment] };
    const snapshot = snapshotFromRoutineItems([source]);
    source.equipment.push("bench" as never);
    expect(snapshot.items[0]!.equipment).toEqual(["barbell"]);
  });

  it("keeps an edited item's id only if it is already in the snapshot", () => {
    const current = snapshotFromRoutineItems([squat], ids());
    const keptId = current.items[0]!.id;
    const edited = [
      workoutItemInputSchema.parse({ id: keptId, name: "Back Squat", instruction: "5 × 5" }),
      workoutItemInputSchema.parse({ id: "99999999-0000-4000-8000-000000000009", name: "Foreign" }),
      workoutItemInputSchema.parse({ name: "New" }),
    ];
    const next = snapshotFromInputItems(edited, current, () => "fresh");
    expect(next.items.map((item) => [item.id, item.source_item_id, item.name])).toEqual([
      [keptId, squat.id, "Back Squat"],
      ["fresh", null, "Foreign"],
      ["fresh", null, "New"],
    ]);
  });

  it("D5: copying a snapshot gives every item a new id and keeps provenance", () => {
    const original = snapshotFromRoutineItems([squat], ids());
    const copy = copySnapshot(original, () => "copy-id");
    expect(copy.items[0]!.id).toBe("copy-id");
    expect(copy.items[0]!.source_item_id).toBe(squat.id);
    expect(original.items[0]!.id).not.toBe("copy-id");
  });

  it("refuses an unreadable stored snapshot", () => {
    expect(() => parseSnapshot({ version: 2, items: [] })).toThrow(DataError);
    expect(() => parseSnapshot([])).toThrow(DataError);
  });
});

describe("sessionFromRow", () => {
  it("derives week and weekday from the date and trims seconds from the time", () => {
    const session = sessionFromRow({
      id: "s1",
      date: "2026-11-15",
      start_time: "07:30:00",
      name: "Long Run",
      category: "running",
      duration_minutes: 90,
      notes: "",
      source_routine_id: null,
      snapshot: { version: 1, items: [] },
    });
    expect(session.weekId).toBe("2026-W46");
    expect(session.day).toBe(7);
    expect(session.startTime).toBe("07:30");
  });

  it("keeps untimed sessions untimed", () => {
    expect(startTimeFromRow(null)).toBeNull();
  });
});
