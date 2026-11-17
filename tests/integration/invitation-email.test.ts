import { afterAll, afterEach, describe, expect, it } from "vitest";
import { deliverInvitationEmail } from "@/lib/admin/invitation-email";
import { latestEmailDelivery } from "@/lib/admin/invitation-model";
import type { EmailTransport, OutgoingEmail, SendResult } from "@/lib/email/resend";
import { createTestUser, deleteTestUsers, integrationReady, service } from "./helpers";

/**
 * Invitation email orchestration against the real database functions
 * (begin_invitation_email / complete_invitation_email), with a fake email
 * provider. The admin check happens in lib/admin/invitations.ts before this
 * code runs; here we prove the delivery rules and that the membership
 * invitation is never changed by sending.
 */

const LOGIN_URL = "https://traingrid.example.test/login";

function fakeTransport(result: SendResult | (() => Promise<SendResult>)) {
  const sent: OutgoingEmail[] = [];
  const transport: EmailTransport = async (email) => {
    sent.push(email);
    return typeof result === "function" ? result() : result;
  };
  return { transport, sent };
}

describe.skipIf(!integrationReady)("invitation email delivery (local Supabase)", () => {
  const emails: string[] = [];

  async function invite(label: string, extra: Record<string, unknown> = {}) {
    const email = `it-mail-${label}-${crypto.randomUUID()}@example.test`;
    emails.push(email);
    const { data, error } = await service()
      .from("invitations")
      .insert({ email, ...extra })
      .select("id, email")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function deliveries(invitationId: string) {
    const { data, error } = await service()
      .from("invitation_email_deliveries")
      .select("status, failure_code, provider_message_id, created_at, finished_at, requested_by")
      .eq("invitation_id", invitationId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return data;
  }

  async function invitationRow(id: string) {
    const { data } = await service()
      .from("invitations")
      .select("accepted_at, accepted_by, revoked_at")
      .eq("id", id)
      .single();
    return data;
  }

  afterEach(async () => {
    if (emails.length) await service().from("invitations").delete().in("email", emails.splice(0));
  });
  afterAll(deleteTestUsers);

  it("sends to the invitation's own address with the trusted link, and records acceptance", async () => {
    const admin = await createTestUser("mail-admin");
    const invitation = await invite("ok");
    const { transport, sent } = fakeTransport({ ok: true, messageId: "msg_abc" });

    const outcome = await deliverInvitationEmail({
      db: service(),
      invitationId: invitation.id,
      requestedBy: admin.id,
      loginUrl: LOGIN_URL,
      transport,
    });

    expect(outcome).toEqual({ kind: "accepted" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(invitation.email);
    expect(sent[0]!.html).toContain(LOGIN_URL);
    expect(sent[0]!.text).toContain(LOGIN_URL);
    expect(sent[0]!.html).toContain("https://traingrid.example.test/brand/traingrid-logo-google-120.png");
    expect(sent[0]!.idempotencyKey).toMatch(/^traingrid-invitation-email\/[0-9a-f-]{36}$/);

    const rows = await deliveries(invitation.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "accepted", provider_message_id: "msg_abc", requested_by: admin.id });
    expect(latestEmailDelivery(rows).state).toBe("accepted");
  });

  it("records a failure and leaves the invitation pending and usable", async () => {
    const invitation = await invite("fail");
    const { transport } = fakeTransport({ ok: false, code: "provider_unavailable", status: 503 });

    const outcome = await deliverInvitationEmail({
      db: service(),
      invitationId: invitation.id,
      requestedBy: null,
      loginUrl: LOGIN_URL,
      transport,
    });

    expect(outcome).toEqual({ kind: "failed", code: "provider_unavailable" });
    expect((await deliveries(invitation.id))[0]).toMatchObject({ status: "failed", failure_code: "provider_unavailable" });
    expect(await invitationRow(invitation.id)).toEqual({ accepted_at: null, accepted_by: null, revoked_at: null });

    // A retry after a failure is allowed and gets a new idempotency key.
    const retry = fakeTransport({ ok: true, messageId: null });
    expect(
      await deliverInvitationEmail({
        db: service(),
        invitationId: invitation.id,
        requestedBy: null,
        loginUrl: LOGIN_URL,
        transport: retry.transport,
      }),
    ).toEqual({ kind: "accepted" });
    expect((await deliveries(invitation.id)).map((row) => row.status)).toEqual(["failed", "accepted"]);
  });

  it("refuses an immediate resend after acceptance without calling the provider", async () => {
    const invitation = await invite("dup");
    const first = fakeTransport({ ok: true, messageId: "msg_1" });
    await deliverInvitationEmail({ db: service(), invitationId: invitation.id, requestedBy: null, loginUrl: LOGIN_URL, transport: first.transport });

    const second = fakeTransport({ ok: true, messageId: "msg_2" });
    expect(
      await deliverInvitationEmail({ db: service(), invitationId: invitation.id, requestedBy: null, loginUrl: LOGIN_URL, transport: second.transport }),
    ).toEqual({ kind: "refused", reason: "recently_sent" });
    expect(second.sent).toHaveLength(0);
  });

  it("lets only one of two simultaneous sends reach the provider", async () => {
    const invitation = await invite("race");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = fakeTransport(async () => {
      await gate;
      return { ok: true, messageId: "msg_slow" };
    });
    const fast = fakeTransport({ ok: true, messageId: "msg_fast" });

    const firstSend = deliverInvitationEmail({ db: service(), invitationId: invitation.id, requestedBy: null, loginUrl: LOGIN_URL, transport: slow.transport });
    // Wait until the first attempt is recorded as in flight.
    for (let i = 0; i < 50 && (await deliveries(invitation.id)).length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const secondSend = await deliverInvitationEmail({ db: service(), invitationId: invitation.id, requestedBy: null, loginUrl: LOGIN_URL, transport: fast.transport });
    release();

    expect(secondSend).toEqual({ kind: "refused", reason: "in_progress" });
    expect(await firstSend).toEqual({ kind: "accepted" });
    expect(fast.sent).toHaveLength(0);
    expect(slow.sent).toHaveLength(1);
  });

  it("never emails a revoked or accepted invitation", async () => {
    const member = await createTestUser("mail-member");
    const revoked = await invite("revoked", { revoked_at: new Date().toISOString() });
    const accepted = await invite("accepted", { accepted_at: new Date().toISOString(), accepted_by: member.id });
    const { transport, sent } = fakeTransport({ ok: true, messageId: "x" });

    expect(
      await deliverInvitationEmail({ db: service(), invitationId: revoked.id, requestedBy: null, loginUrl: LOGIN_URL, transport }),
    ).toEqual({ kind: "refused", reason: "revoked" });
    expect(
      await deliverInvitationEmail({ db: service(), invitationId: accepted.id, requestedBy: null, loginUrl: LOGIN_URL, transport }),
    ).toEqual({ kind: "refused", reason: "already_accepted" });
    expect(
      await deliverInvitationEmail({ db: service(), invitationId: crypto.randomUUID(), requestedBy: null, loginUrl: LOGIN_URL, transport }),
    ).toEqual({ kind: "refused", reason: "not_found" });
    expect(sent).toHaveLength(0);
  });

  it("records an unusable link as a failure without sending", async () => {
    const invitation = await invite("badurl");
    const { transport, sent } = fakeTransport({ ok: true, messageId: "x" });
    expect(
      await deliverInvitationEmail({ db: service(), invitationId: invitation.id, requestedBy: null, loginUrl: "javascript:alert(1)", transport }),
    ).toEqual({ kind: "failed", code: "provider_rejected" });
    expect(sent).toHaveLength(0);
    expect((await deliveries(invitation.id))[0]).toMatchObject({ status: "failed" });
  });

  it("keeps the delivery log closed to members", async () => {
    const member = await createTestUser("mail-reader");
    const read = await member.db.from("invitation_email_deliveries").select("*");
    expect(read.error).not.toBeNull();
    const call = await member.db.rpc("begin_invitation_email", {
      p_invitation_id: crypto.randomUUID(),
      p_requested_by: member.id,
    });
    expect(call.error).not.toBeNull();
  });
});
