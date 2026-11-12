import { describe, expect, it } from "vitest";
import { invitationEmailSchema, invitationIdSchema, invitationStatus } from "./invitation-model";

describe("invitationStatus", () => {
  it("derives the three statuses", () => {
    expect(invitationStatus({ accepted_at: null, revoked_at: null })).toBe("Pending");
    expect(invitationStatus({ accepted_at: "2026-11-12T00:00:00Z", revoked_at: null })).toBe("Accepted");
    expect(invitationStatus({ accepted_at: null, revoked_at: "2026-11-12T00:00:00Z" })).toBe("Revoked");
  });
});

describe("invitationEmailSchema", () => {
  it("trims and lower-cases", () => {
    expect(invitationEmailSchema.parse("  Friend@Example.Test ")).toBe("friend@example.test");
  });

  it("rejects values that are not email addresses", () => {
    for (const value of ["", "   ", "friend", "friend@", "@example.test", "a b@example.test", 42, null]) {
      expect(invitationEmailSchema.safeParse(value).success, String(value)).toBe(false);
    }
  });

  it("rejects overlong values", () => {
    expect(invitationEmailSchema.safeParse(`${"a".repeat(320)}@example.test`).success).toBe(false);
  });
});

describe("invitationIdSchema", () => {
  it("accepts UUIDs only", () => {
    expect(invitationIdSchema.safeParse("50000000-0000-4000-8000-000000000001").success).toBe(true);
    expect(invitationIdSchema.safeParse("1 or 1=1").success).toBe(false);
    expect(invitationIdSchema.safeParse("").success).toBe(false);
  });
});
