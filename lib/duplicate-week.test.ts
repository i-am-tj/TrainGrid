import { describe, expect, it } from "vitest";
import type { ScheduledSession } from "./domain";
import { duplicateWeekSessions } from "./duplicate-week";

const monday: ScheduledSession = {
  id: "orig-1",
  name: "Speed Run",
  type: "running",
  weekId: "2026-W36",
  day: 1,
  time: "07:00",
  durationMinutes: 45,
  notes: "track",
  templateId: "speed-run",
  bodySnapshot: null,
};

describe("duplicate week", () => {
  it("copies sessions onto the destination week with new ids", () => {
    let n = 0;
    const copies = duplicateWeekSessions([monday], "2026-W36", "2026-W37", () => `new-${++n}`);
    expect(copies).toHaveLength(1);
    expect(copies[0]?.id).toBe("new-1");
    expect(copies[0]?.weekId).toBe("2026-W37");
    expect(copies[0]?.day).toBe(1);
    expect(copies[0]?.time).toBe("07:00");
    expect(copies[0]?.name).toBe("Speed Run");
    expect(monday.id).toBe("orig-1");
    expect(monday.weekId).toBe("2026-W36");
  });

  it("does not copy from other weeks", () => {
    const other = { ...monday, id: "x", weekId: "2026-W35" };
    expect(duplicateWeekSessions([monday, other], "2026-W36", "2026-W37")).toHaveLength(1);
  });

  it("refuses to copy onto the same week", () => {
    expect(() => duplicateWeekSessions([monday], "2026-W36", "2026-W36")).toThrow(
      /different week/i,
    );
  });
});
