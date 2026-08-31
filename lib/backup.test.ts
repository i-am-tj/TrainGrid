import { describe, expect, it } from "vitest";
import { parseBackupJson } from "./backup";
import { coerceSession } from "./schedule";

const valid = {
  version: 1 as const,
  exportedAt: "2026-08-31T00:00:00.000Z",
  templates: [
    {
      id: "lower-a",
      name: "Lower A",
      type: "strength",
      description: "",
      body: "## Back Squat\n",
    },
  ],
  sessions: [
    {
      id: "abc",
      name: "Lower A",
      type: "strength",
      weekId: "2026-W36",
      day: 1,
      time: "08:00",
      durationMinutes: null,
      notes: "",
      templateId: "lower-a",
      bodySnapshot: null,
    },
  ],
};

describe("backup parse", () => {
  it("accepts a version 1 backup", () => {
    const result = parseBackupJson(JSON.stringify(valid));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.templates[0]?.name).toBe("Lower A");
      expect(result.backup.sessions[0]?.time).toBe("08:00");
    }
  });

  it("rejects malformed JSON without throwing", () => {
    const result = parseBackupJson("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/i);
  });

  it("rejects the wrong version", () => {
    const result = parseBackupJson(JSON.stringify({ ...valid, version: 2 }));
    expect(result.ok).toBe(false);
  });

  it("rejects invalid sessions instead of dropping them", () => {
    const result = parseBackupJson(
      JSON.stringify({
        ...valid,
        sessions: [{ ...valid.sessions[0], weekId: "nope" }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid clock times", () => {
    expect(coerceSession({ ...valid.sessions[0], time: "07:15" })).toBeNull();
    expect(coerceSession({ ...valid.sessions[0], name: "   " })).toBeNull();
  });
});
