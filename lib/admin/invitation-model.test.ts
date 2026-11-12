import { describe, expect, it } from "vitest";
import {
  invitationEmailSchema,
  invitationIdSchema,
  invitationStatus,
  revokeKind,
} from "./invitation-model";

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

describe("revokeKind", () => {
  const ADMIN = "11111111-1111-4111-8111-111111111111";
  const MEMBER = "22222222-2222-4222-8222-222222222222";
  const admins = new Set([ADMIN]);
  const at = "2026-11-12T00:00:00Z";

  it("offers to revoke a pending invitation", () => {
    expect(revokeKind({ accepted_at: null, accepted_by: null, revoked_at: null }, admins)).toBe("invitation");
  });

  it("offers to revoke an accepted member's access", () => {
    expect(revokeKind({ accepted_at: at, accepted_by: MEMBER, revoked_at: null }, admins)).toBe("access");
  });

  it("never offers to revoke an admin, whatever the case of the id", () => {
    expect(revokeKind({ accepted_at: at, accepted_by: ADMIN, revoked_at: null }, admins)).toBeNull();
    expect(revokeKind({ accepted_at: at, accepted_by: ADMIN.toUpperCase(), revoked_at: null }, admins)).toBeNull();
  });

  it("offers nothing for an invitation that is already revoked", () => {
    expect(revokeKind({ accepted_at: at, accepted_by: MEMBER, revoked_at: at }, admins)).toBeNull();
    expect(revokeKind({ accepted_at: null, accepted_by: null, revoked_at: at }, admins)).toBeNull();
  });
});
