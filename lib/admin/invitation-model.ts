import { z } from "zod";

/** Pure invitation helpers shared by the server functions and the page. */

export type InvitationRow = {
  id: string;
  email: string;
  created_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
};

export type InvitationStatus = "Pending" | "Accepted" | "Revoked";

export function invitationStatus(row: Pick<InvitationRow, "accepted_at" | "revoked_at">): InvitationStatus {
  if (row.revoked_at) return "Revoked";
  if (row.accepted_at) return "Accepted";
  return "Pending";
}

/**
 * What an admin may revoke for this row:
 *   "invitation" — a pending invitation;
 *   "access"     — an accepted member's access (their data is kept);
 *   null         — nothing (already revoked, or the member is an admin).
 */
export type RevokeKind = "invitation" | "access" | null;

export function revokeKind(
  row: Pick<InvitationRow, "accepted_at" | "accepted_by" | "revoked_at">,
  protectedUserIds: ReadonlySet<string>,
): RevokeKind {
  if (row.revoked_at) return null;
  if (!row.accepted_at) return "invitation";
  if (row.accepted_by && protectedUserIds.has(row.accepted_by.toLowerCase())) return null;
  return "access";
}

/** Email as stored and matched: trimmed and lower-cased. */
export const invitationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(320)
  .pipe(z.email());

export const invitationIdSchema = z.uuid();

// ---------------------------------------------------------------------------
// Invitation email delivery (separate from membership status)
// ---------------------------------------------------------------------------

/** A row of invitation_email_deliveries, as the list reads it. */
export type EmailDeliveryRow = {
  status: string;
  failure_code: string | null;
  created_at: string;
  finished_at: string | null;
};

/**
 * What is known about the latest email for an invitation. "accepted" means
 * the provider accepted the request; there is deliberately no "delivered".
 */
export type EmailDeliveryState = "not_requested" | "preparing" | "accepted" | "failed";

export type EmailDeliverySummary = {
  state: EmailDeliveryState;
  /** When the latest attempt finished (or started, while preparing). */
  at: string | null;
  failureCode: string | null;
};

const STALE_PREPARING_MS = 2 * 60 * 1000;

/**
 * The latest attempt decides the state. An attempt still "preparing" after
 * two minutes was interrupted (the database closes it on the next send), so
 * it is shown as failed rather than as sending forever.
 */
export function latestEmailDelivery(
  rows: readonly EmailDeliveryRow[] | null | undefined,
  now: Date = new Date(),
): EmailDeliverySummary {
  const latest = [...(rows ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) return { state: "not_requested", at: null, failureCode: null };
  if (latest.status === "accepted") {
    return { state: "accepted", at: latest.finished_at, failureCode: null };
  }
  if (latest.status === "preparing") {
    const stale = now.getTime() - new Date(latest.created_at).getTime() > STALE_PREPARING_MS;
    return stale
      ? { state: "failed", at: latest.created_at, failureCode: "interrupted" }
      : { state: "preparing", at: latest.created_at, failureCode: null };
  }
  return { state: "failed", at: latest.finished_at, failureCode: latest.failure_code };
}

/** Only a live invitation that has not been accepted can be emailed. */
export function canEmailInvitation(
  row: Pick<InvitationRow, "accepted_at" | "revoked_at">,
  delivery: EmailDeliverySummary,
): boolean {
  return invitationStatus(row) === "Pending" && delivery.state !== "preparing";
}

export type EmailFeedback = { tone: "success" | "warning" | "error"; message: string };

type OutcomeLike =
  | { kind: "accepted" }
  | { kind: "failed"; code: string }
  | { kind: "refused"; reason: string }
  | { kind: "error" }
  | { kind: "not_configured" };

/**
 * Admin-facing feedback for one send. Never includes provider responses,
 * keys or addresses, and never claims the email reached the inbox.
 */
export function emailFeedback(outcome: OutcomeLike): EmailFeedback {
  switch (outcome.kind) {
    case "accepted":
      return {
        tone: "success",
        message:
          "Email accepted by the email provider. This doesn’t confirm it reached their inbox.",
      };
    case "failed":
      return outcome.code === "rate_limited"
        ? {
            tone: "warning",
            message:
              "The email service is busy, so the email wasn’t sent. The invitation is still valid — try again in a few minutes.",
          }
        : {
            tone: "warning",
            message:
              "The email couldn’t be sent. The invitation is still valid — try again, or share the sign-in link yourself.",
          };
    case "refused":
      switch (outcome.reason) {
        case "in_progress":
          return { tone: "warning", message: "An email for this invitation is already being sent." };
        case "recently_sent":
          return {
            tone: "warning",
            message: "An email was just sent for this invitation. Wait a minute before sending again.",
          };
        case "limit_reached":
          return {
            tone: "warning",
            message:
              "This invitation has been emailed five times today. Share the sign-in link yourself instead.",
          };
        case "revoked":
          return { tone: "error", message: "That invitation is revoked, so no email was sent." };
        case "already_accepted":
          return { tone: "error", message: "That invitation is already accepted, so no email was sent." };
        default:
          return { tone: "error", message: "Unknown invitation." };
      }
    case "not_configured":
      return {
        tone: "warning",
        message: "Email sending isn’t set up on this deployment. Share the sign-in link yourself.",
      };
    default:
      return {
        tone: "error",
        message: "The email status couldn’t be recorded. Check the list before trying again.",
      };
  }
}

/** The list's email line. Truthful: "accepted by provider", never "delivered". */
export function emailStatusLabel(
  delivery: EmailDeliverySummary,
  formatTime: (iso: string) => string,
): { label: string; tone: "neutral" | "success" | "warning" } {
  const when = delivery.at ? ` · ${formatTime(delivery.at)}` : "";
  switch (delivery.state) {
    case "accepted":
      return { label: `Email accepted by provider${when}`, tone: "success" };
    case "preparing":
      return { label: "Email sending…", tone: "neutral" };
    case "failed":
      return { label: `Email failed${when} · invitation still valid`, tone: "warning" };
    default:
      return { label: "Email not sent", tone: "neutral" };
  }
}
