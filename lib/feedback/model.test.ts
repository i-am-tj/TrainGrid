import { describe, expect, it } from "vitest";
import { feedbackEmail, parseFeedback, safePagePath } from "./model";

describe("parseFeedback", () => {
  it("accepts a kind and a trimmed message", () => {
    expect(parseFeedback({ kind: "idea", message: "  Dark calendar  ", pagePath: "/home" })).toEqual({
      ok: true,
      value: { kind: "idea", message: "Dark calendar", pagePath: "/home" },
    });
  });

  it("refuses an unknown kind, an empty message and an overlong one", () => {
    expect(parseFeedback({ kind: "rant", message: "Hi", pagePath: null })).toMatchObject({
      ok: false,
      state: { field: "kind" },
    });
    expect(parseFeedback({ kind: "idea", message: "   ", pagePath: null })).toMatchObject({
      ok: false,
      state: { field: "message", message: "Write a few words first." },
    });
    expect(parseFeedback({ kind: "idea", message: "x".repeat(2001), pagePath: null })).toMatchObject({
      ok: false,
      state: { field: "message" },
    });
  });
});

describe("safePagePath", () => {
  it("keeps a local path and drops its query", () => {
    expect(safePagePath("/library?q=squat")).toBe("/library");
    expect(safePagePath("/week/2026-W47")).toBe("/week/2026-W47");
  });

  it("refuses anything that is not a local path", () => {
    for (const value of ["https://evil.example/x", "//evil.example", "home", "/a b", "/<script>", 42, null]) {
      expect(safePagePath(value)).toBeNull();
    }
    expect(safePagePath(`/${"a".repeat(200)}`)).toBeNull();
  });
});

describe("feedbackEmail", () => {
  it("names the member and the page, and escapes the message in HTML", () => {
    const email = feedbackEmail({
      input: { kind: "problem", message: "<b>broken</b> & slow", pagePath: "/home" },
      memberName: "Sam",
      memberEmail: "sam@example.test",
    });
    expect(email.subject).toBe("TrainGrid feedback · Problem from Sam");
    expect(email.text).toContain("Problem from Sam <sam@example.test>");
    expect(email.text).toContain("Sent from /home");
    expect(email.text).toContain("<b>broken</b> & slow");
    expect(email.html).toContain("&lt;b&gt;broken&lt;/b&gt; &amp; slow");
    expect(email.html).not.toContain("<b>broken</b>");
  });

  it("falls back to the email, then to 'A member'", () => {
    const input = { kind: "idea" as const, message: "Hi", pagePath: null };
    expect(feedbackEmail({ input, memberName: null, memberEmail: "x@example.test" }).subject).toBe(
      "TrainGrid feedback · Idea from x@example.test",
    );
    expect(feedbackEmail({ input, memberName: null, memberEmail: null }).subject).toBe(
      "TrainGrid feedback · Idea from A member",
    );
  });
});
