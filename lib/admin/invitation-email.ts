/**
 * Sends the invitation email for one invitation and records the outcome.
 *
 * The CALLER must already have confirmed the current user is an admin and
 * must pass the secret-key client (lib/admin/invitations.ts does both). This
 * module has no Next.js or `server-only` import so the integration tests can
 * run it against the local database with a fake transport.
 *
 * Rules (enforced in the database by begin_invitation_email()):
 *   - only a live, not yet accepted invitation is emailed, to its own address;
 *   - one attempt in flight per invitation; a minute's pause after an accepted
 *     send; at most five attempts a day;
 *   - the invitation itself is never changed, whatever the provider says.
 */

import type { Db } from "@/lib/data/model";
import { renderInvitationEmail } from "@/lib/email/invitation";
import type { EmailTransport, SendFailureCode } from "@/lib/email/resend";

export type DeliveryRefusal =
  | "not_found"
  | "revoked"
  | "already_accepted"
  | "in_progress"
  | "recently_sent"
  | "limit_reached";

export type DeliveryOutcome =
  | { kind: "accepted" }
  | { kind: "failed"; code: SendFailureCode }
  | { kind: "refused"; reason: DeliveryRefusal }
  /** The database could not be read or written; nothing is known to be sent. */
  | { kind: "error" };

const REFUSALS: readonly DeliveryRefusal[] = [
  "not_found",
  "revoked",
  "already_accepted",
  "in_progress",
  "recently_sent",
  "limit_reached",
];

export async function deliverInvitationEmail({
  db,
  invitationId,
  requestedBy,
  loginUrl,
  transport,
}: {
  db: Db;
  invitationId: string;
  requestedBy: string | null;
  loginUrl: string;
  transport: EmailTransport;
}): Promise<DeliveryOutcome> {
  const begin = await db.rpc("begin_invitation_email", {
    p_invitation_id: invitationId,
    p_requested_by: requestedBy as string,
  });
  const row = begin.data?.[0];
  if (begin.error || !row) return { kind: "error" };
  if (row.outcome !== "started") {
    const reason = REFUSALS.find((value) => value === row.outcome);
    return reason ? { kind: "refused", reason } : { kind: "error" };
  }

  const deliveryId = row.delivery_id;
  let result: Awaited<ReturnType<EmailTransport>>;
  try {
    const email = renderInvitationEmail({ recipientEmail: row.recipient_email, loginUrl });
    result = await transport({
      to: row.recipient_email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `traingrid-invitation-email/${deliveryId}`,
    });
  } catch {
    // The template refused its input (an unusable address or URL): nothing was sent.
    result = { ok: false, code: "provider_rejected", status: null };
  }

  const finish = await db.rpc(
    "complete_invitation_email",
    result.ok
      ? {
          p_delivery_id: deliveryId,
          p_status: "accepted",
          ...(result.messageId ? { p_provider_message_id: result.messageId } : {}),
        }
      : { p_delivery_id: deliveryId, p_status: "failed", p_failure_code: result.code },
  );
  if (finish.error) return { kind: "error" };

  return result.ok ? { kind: "accepted" } : { kind: "failed", code: result.code };
}
