import { describe, expect, it } from "vitest";
import { initialsFor, memberSince, plural, profileName, timeZoneLabel } from "./model";

describe("initialsFor", () => {
  it("uses the first and last word of the display name", () => {
    expect(initialsFor("Ada King Lovelace", "ada@example.test")).toBe("AL");
    expect(initialsFor("  ada  ", null)).toBe("A");
  });
  it("falls back to the email, then to a question mark", () => {
    expect(initialsFor(null, "zed@example.test")).toBe("Z");
    expect(initialsFor("   ", null)).toBe("?");
  });
  it("keeps whole characters and skips punctuation-only words", () => {
    expect(initialsFor("Émile — Zola", null)).toBe("ÉZ");
  });
});

describe("profileName", () => {
  it("prefers the display name, then the email's local part", () => {
    expect(profileName(" Ada ", "x@y.z")).toBe("Ada");
    expect(profileName(null, "runner@example.test")).toBe("runner");
    expect(profileName(null, null)).toBe("Member");
  });
});

describe("memberSince", () => {
  it("formats the month and year in UTC", () => {
    expect(memberSince("2026-11-18T10:00:00Z")).toBe("November 2026");
    expect(memberSince("2026-12-01T00:30:00+05:30")).toBe("November 2026");
  });
  it("is null for missing or unreadable dates", () => {
    expect(memberSince(null)).toBeNull();
    expect(memberSince("soon")).toBeNull();
  });
});

describe("plural and timeZoneLabel", () => {
  it("counts", () => {
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(1200, "session")).toBe("1,200 sessions");
  });
  it("spaces out zone names", () => {
    expect(timeZoneLabel("America/Argentina/Buenos_Aires")).toBe("America / Argentina / Buenos Aires");
  });
});
