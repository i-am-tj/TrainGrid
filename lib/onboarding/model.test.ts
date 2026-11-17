import { describe, expect, it } from "vitest";
import { onboardingSteps, showOnboarding } from "./model";

const none = { plannedSession: false, ownRoutine: false, scheduledRoutine: false };
const all = { plannedSession: true, ownRoutine: true, scheduledRoutine: true };

describe("onboardingSteps", () => {
  it("lists three steps in order, each done from the member's data", () => {
    const steps = onboardingSteps({ ...none, ownRoutine: true }, { addSessionHref: "/week/2026-W47/add?day=3" });
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ["plannedSession", false],
      ["ownRoutine", true],
      ["scheduledRoutine", false],
    ]);
    expect(steps[0]!.href).toBe("/week/2026-W47/add?day=3");
    expect(steps.every((step) => step.href.startsWith("/"))).toBe(true);
  });
});

describe("showOnboarding", () => {
  it("shows until everything is done", () => {
    expect(showOnboarding(none, false)).toBe(true);
    expect(showOnboarding({ ...all, scheduledRoutine: false }, false)).toBe(true);
    expect(showOnboarding(all, false)).toBe(false);
  });

  it("stays hidden once dismissed, or when progress could not be read", () => {
    expect(showOnboarding(none, true)).toBe(false);
    expect(showOnboarding(null, false)).toBe(false);
  });
});
