import { describe, expect, it } from "vitest";
import {
  canEmailInvitation,
  emailFeedback,
  emailStatusLabel,
  invitationEmailSchema,
  invitationIdSchema,
  invitationStatus,
  latestEmailDelivery,
  revokeKind,
  type EmailDeliveryRow,
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

describe("invitation email delivery state", () => {
  const now = new Date("2026-11-17T10:00:00Z");
  const row = (status: string, created: string, extra: Partial<EmailDeliveryRow> = {}): EmailDeliveryRow => ({
    status,
    failure_code: null,
    created_at: created,
    finished_at: status === "preparing" ? null : created,
    ...extra,
  });

  it("is not requested without attempts", () => {
    expect(latestEmailDelivery([], now)).toEqual({ state: "not_requested", at: null, failureCode: null });
    expect(latestEmailDelivery(null, now).state).toBe("not_requested");
  });

  it("follows the latest attempt only", () => {
    const rows = [
      row("failed", "2026-11-17T09:00:00Z", { failure_code: "timeout" }),
      row("accepted", "2026-11-17T09:30:00Z"),
    ];
    expect(latestEmailDelivery(rows, now)).toEqual({
      state: "accepted",
      at: "2026-11-17T09:30:00Z",
      failureCode: null,
    });
    expect(latestEmailDelivery([...rows, row("failed", "2026-11-17T09:45:00Z", { failure_code: "rate_limited" })], now))
      .toMatchObject({ state: "failed", failureCode: "rate_limited" });
  });

  it("shows a stale in-flight attempt as failed, not as sending forever", () => {
    expect(latestEmailDelivery([row("preparing", "2026-11-17T09:59:30Z")], now).state).toBe("preparing");
    expect(latestEmailDelivery([row("preparing", "2026-11-17T09:50:00Z")], now)).toMatchObject({
      state: "failed",
      failureCode: "interrupted",
    });
  });

  it("allows emailing only live, unaccepted invitations with nothing in flight", () => {
    const idle = latestEmailDelivery([], now);
    const sending = latestEmailDelivery([row("preparing", "2026-11-17T09:59:30Z")], now);
    expect(canEmailInvitation({ accepted_at: null, revoked_at: null }, idle)).toBe(true);
    expect(canEmailInvitation({ accepted_at: null, revoked_at: null }, sending)).toBe(false);
    expect(canEmailInvitation({ accepted_at: "x", revoked_at: null }, idle)).toBe(false);
    expect(canEmailInvitation({ accepted_at: null, revoked_at: "x" }, idle)).toBe(false);
  });

  it("labels an accepted request truthfully, never as delivered", () => {
    const fmt = () => "17 Nov 2026, 09:30";
    const accepted = emailStatusLabel(latestEmailDelivery([row("accepted", "2026-11-17T09:30:00Z")], now), fmt);
    expect(accepted.label).toBe("Email accepted by provider · 17 Nov 2026, 09:30");
    expect(accepted.label).not.toMatch(/deliver/i);
    expect(emailStatusLabel(latestEmailDelivery([], now), fmt).label).toBe("Email not sent");
    expect(
      emailStatusLabel(latestEmailDelivery([row("failed", "2026-11-17T09:30:00Z", { failure_code: "timeout" })], now), fmt)
        .label,
    ).toBe("Email failed · 17 Nov 2026, 09:30 · invitation still valid");
  });

  it("gives admin feedback without provider details or delivery claims", () => {
    const accepted = emailFeedback({ kind: "accepted" });
    expect(accepted.tone).toBe("success");
    expect(accepted.message).toContain("doesn’t confirm");
    for (const code of ["provider_auth", "provider_rejected", "provider_unavailable", "timeout"]) {
      const feedback = emailFeedback({ kind: "failed", code });
      expect(feedback.message).toContain("The invitation is still valid");
      expect(feedback.message).not.toContain(code);
    }
    expect(emailFeedback({ kind: "failed", code: "rate_limited" }).message).toContain("try again in a few minutes");
    expect(emailFeedback({ kind: "refused", reason: "in_progress" }).message).toContain("already being sent");
    expect(emailFeedback({ kind: "refused", reason: "revoked" }).tone).toBe("error");
    expect(emailFeedback({ kind: "not_configured" }).message).toContain("isn’t set up");
    expect(emailFeedback({ kind: "error" }).tone).toBe("error");
  });
});
