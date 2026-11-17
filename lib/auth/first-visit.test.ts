import { describe, expect, it } from "vitest";
import { isFirstVisit, sessionSignedInAt } from "./first-visit";

const signIn = Date.parse("2026-11-17T10:00:00Z") / 1000;
const amr = [{ method: "oauth", timestamp: signIn }];

describe("isFirstVisit", () => {
  it("is true for the session that accepted the invitation", () => {
    expect(isFirstVisit(amr, "2026-11-17T10:00:01.250Z")).toBe(true);
  });

  it("allows a few seconds of clock difference between auth and the database", () => {
    expect(isFirstVisit(amr, "2026-11-17T09:59:57Z")).toBe(true);
    expect(isFirstVisit(amr, "2026-11-17T09:59:50Z")).toBe(false);
  });

  it("is false for any later sign-in, even one shortly after joining", () => {
    const later = [{ method: "oauth", timestamp: signIn + 60 }];
    expect(isFirstVisit(later, "2026-11-17T10:00:01Z")).toBe(false);
  });

  it("stays true for the whole first session, including token refreshes", () => {
    // A refreshed token keeps the original sign-in time in amr.
    expect(isFirstVisit(amr, "2026-11-17T10:00:02Z")).toBe(true);
  });

  it("uses the session's first method when MFA added another", () => {
    const withMfa = [
      { method: "oauth", timestamp: signIn },
      { method: "totp", timestamp: signIn + 30 },
    ];
    expect(sessionSignedInAt(withMfa)).toBe(signIn * 1000);
    expect(isFirstVisit(withMfa, "2026-11-17T10:00:01Z")).toBe(true);
  });

  it("treats missing or malformed data as a returning member", () => {
    expect(isFirstVisit(undefined, "2026-11-17T10:00:01Z")).toBe(false);
    expect(isFirstVisit(["oauth"], "2026-11-17T10:00:01Z")).toBe(false);
    expect(isFirstVisit([{ method: "oauth", timestamp: "soon" }], "2026-11-17T10:00:01Z")).toBe(false);
    expect(isFirstVisit(amr, null)).toBe(false);
    expect(isFirstVisit(amr, "not a date")).toBe(false);
  });
});
