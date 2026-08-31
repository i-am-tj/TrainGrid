import { describe, expect, it } from "vitest";
import { compareSessions, isSessionType, sanitizeName, SESSION_TYPES } from "./domain";
import { slugify, uniqueId } from "./slug";

describe("session types", () => {
  it("uses plyometrics instead of mobility", () => {
    expect(SESSION_TYPES).toEqual(["running", "strength", "plyometrics", "other"]);
    expect(isSessionType("plyometrics")).toBe(true);
    expect(isSessionType("other")).toBe(true);
    expect(isSessionType("mobility")).toBe(false);
  });
});

describe("names", () => {
  it("rejects blank names and trims", () => {
    expect(sanitizeName("   ")).toBeNull();
    expect(sanitizeName("  Lower A  ")).toBe("Lower A");
  });

  it("caps very long names", () => {
    const name = sanitizeName("A".repeat(500));
    expect(name).toHaveLength(200);
  });
});

describe("slugs", () => {
  it("slugifies unusual characters", () => {
    expect(slugify("VO2 — 6 × 200m")).toBe("vo2-6-200m");
  });

  it("makes duplicate ids unique", () => {
    expect(uniqueId("lower-a", new Set(["lower-a"]))).toBe("lower-a-2");
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
      notes: "",
      templateId: null,
      bodySnapshot: "",
    };
    const b = { ...a, id: "a", name: "A", time: "07:00" };
    const c = { ...a, id: "c", name: "Rest", time: null };
    const sorted = [a, b, c].sort(compareSessions);
    expect(sorted.map((s) => s.name)).toEqual(["Rest", "A", "B"]);
  });
});
