import { describe, expect, it } from "vitest";
import { inviteRequestEmail, parseInviteRequest, stateForOutcome } from "./model";
import { clientIp, networkHash } from "./network";

describe("parseInviteRequest", () => {
  it("normalises the email and empties optional fields", () => {
    expect(parseInviteRequest({ email: "  Riley@Example.TEST ", name: "  ", note: "" })).toEqual({
      ok: true,
      value: { email: "riley@example.test", name: null, note: null },
    });
  });
  it("keeps a trimmed name and note", () => {
    const result = parseInviteRequest({ email: "a@b.test", name: " Riley ", note: " Hi " });
    expect(result).toEqual({ ok: true, value: { email: "a@b.test", name: "Riley", note: "Hi" } });
  });
  it("names the field that is wrong", () => {
    expect(parseInviteRequest({ email: "nope", name: "", note: "" })).toMatchObject({ ok: false, state: { field: "email" } });
    expect(parseInviteRequest({ email: "", name: "", note: "" })).toMatchObject({
      state: { field: "email", message: "Enter your email address." },
    });
    expect(parseInviteRequest({ email: "a@b.test", name: "n".repeat(81), note: "" })).toMatchObject({ state: { field: "name" } });
    expect(parseInviteRequest({ email: "a@b.test", name: "", note: "n".repeat(501) })).toMatchObject({ state: { field: "note" } });
  });
  it("treats non-strings as empty", () => {
    expect(parseInviteRequest({ email: null, name: 3, note: undefined })).toMatchObject({ ok: false });
  });
});

describe("stateForOutcome", () => {
  it("never tells a new request from an existing invitation", () => {
    expect(stateForOutcome("created", "a@b.test")).toEqual(stateForOutcome("received", "a@b.test"));
  });
  it("explains limits without detail about other people", () => {
    expect(stateForOutcome("rate_limited", "a@b.test")).toMatchObject({ status: "error" });
    expect(stateForOutcome("paused", "a@b.test")).toMatchObject({ status: "error" });
  });
});

describe("networkHash and clientIp", () => {
  const day = new Date("2026-11-20T10:00:00Z");
  it("is a stable keyed hash within a day and changes the next day", () => {
    const a = networkHash("203.0.113.9", "key", day);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(networkHash("203.0.113.9", "key", new Date("2026-11-20T23:59:00Z"))).toBe(a);
    expect(networkHash("203.0.113.9", "key", new Date("2026-11-21T00:01:00Z"))).not.toBe(a);
    expect(networkHash("203.0.113.9", "other", day)).not.toBe(a);
  });
  it("is null without an address or key", () => {
    expect(networkHash(null, "key", day)).toBeNull();
    expect(networkHash("203.0.113.9", "", day)).toBeNull();
  });
  it("takes the first forwarded address", () => {
    expect(clientIp("203.0.113.9, 10.0.0.1", null)).toBe("203.0.113.9");
    expect(clientIp(null, " 198.51.100.2 ")).toBe("198.51.100.2");
    expect(clientIp(null, null)).toBeNull();
  });
});

describe("inviteRequestEmail", () => {
  it("escapes everything the visitor wrote", () => {
    const email = inviteRequestEmail(
      { email: "a@b.test", name: "<b>Riley</b>", note: "<script>x</script>" },
      "https://traingrid.example/admin/invitations",
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Riley");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.text).toContain("https://traingrid.example/admin/invitations");
    expect(email.subject).toBe("TrainGrid invite request · <b>Riley</b>");
  });
  it("works without a name, note or link", () => {
    const email = inviteRequestEmail({ email: "a@b.test", name: null, note: null }, null);
    expect(email.subject).toBe("TrainGrid invite request · a@b.test");
    expect(email.text).toContain("Invitations page in TrainGrid");
  });
});
