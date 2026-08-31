import { describe, expect, it } from "vitest";
import type { ScheduledSession, SessionTemplate } from "./domain";
import { resolveSession, templatesById } from "./resolve-session";

const template: SessionTemplate = {
  id: "lower-a",
  name: "Lower A",
  type: "strength",
  description: "",
  body: "## Back Squat\n\n3 × 6–8\n",
};

function session(partial: Partial<ScheduledSession>): ScheduledSession {
  return {
    id: "s1",
    name: "Lower A",
    type: "strength",
    weekId: "2026-W36",
    day: 1,
    time: "08:00",
    durationMinutes: null,
    notes: "",
    templateId: "lower-a",
    bodySnapshot: null,
    ...partial,
  };
}

describe("template vs scheduled session", () => {
  it("live-links body from the template without using the template name", () => {
    const resolved = resolveSession(session({ name: "Monday lift" }), templatesById([template]));
    expect(resolved.name).toBe("Monday lift");
    expect(resolved.body).toContain("Back Squat");
    expect(resolved.source).toBe("template");
  });

  it("does not follow template body after snapshot", () => {
    const resolved = resolveSession(
      session({ bodySnapshot: "## Back Squat\n\n4 × 5–6\n" }),
      templatesById([{ ...template, body: "## Back Squat\n\n9 × 9\n" }]),
    );
    expect(resolved.body).toContain("4 × 5–6");
    expect(resolved.source).toBe("snapshot");
  });

  it("keeps ad-hoc content without a template", () => {
    const resolved = resolveSession(
      session({ templateId: null, bodySnapshot: "## Easy\n\n30 min\n", name: "Shakeout" }),
      templatesById([]),
    );
    expect(resolved.source).toBe("adhoc");
    expect(resolved.name).toBe("Shakeout");
    expect(resolved.body).toContain("30 min");
  });

  it("keeps a stored name if the template file is missing", () => {
    const resolved = resolveSession(session({ name: "Lower A" }), templatesById([]));
    expect(resolved.name).toBe("Lower A");
    expect(resolved.body).toBe("");
    expect(resolved.source).toBe("template");
  });
});
