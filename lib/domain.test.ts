import { describe, expect, it } from "vitest";
import { compareSessions, isSessionType, SESSION_TYPES } from "./domain";

describe("session types", () => {
  it("uses plyometrics instead of mobility", () => {
    expect(SESSION_TYPES).toEqual(["running", "strength", "plyometrics", "other"]);
    expect(isSessionType("plyometrics")).toBe(true);
    expect(isSessionType("other")).toBe(true);
    expect(isSessionType("mobility")).toBe(false);
  });
});

describe("session order", () => {
  it("sorts untimed first then by time", () => {
    const a = {
      id: "b",
      name: "B",
      type: "running" as const,
      weekId: "2026-W36",
      day: 1 as const,
      time: "08:30",
      durationMinutes: null,
    };
    const b = { ...a, id: "a", name: "A", time: "07:00" };
    const c = { ...a, id: "c", name: "Rest", time: null };
    const sorted = [a, b, c].sort(compareSessions);
    expect(sorted.map((s) => s.name)).toEqual(["Rest", "A", "B"]);
  });
});
