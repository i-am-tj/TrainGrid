import "server-only";

import { parseAdminUserIds } from "@/lib/admin/access";
import { getAdminViewer } from "@/lib/admin/guard";
import { deliverInvitationEmail, type DeliveryOutcome } from "@/lib/admin/invitation-email";
import {
  invitationEmailSchema,
  invitationIdSchema,
  type EmailDeliveryRow,
  type InvitationRow,
} from "@/lib/admin/invitation-model";
import { readEmailConfig } from "@/lib/email/config";
import { createResendTransport } from "@/lib/email/resend";
import { trustedLoginUrl } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Invitation management. Each function checks that the caller is an admin
 * before the secret-key client is even created.
 */

export class NotAdminError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "NotAdminError";
  }
}

export type MutationResult = { ok: true; id?: string } | { ok: false; message: string };

export type InvitationListRow = InvitationRow & { deliveries: EmailDeliveryRow[] };

const COLUMNS = "id, email, created_at, accepted_at, accepted_by, revoked_at";
const DELIVERY_COLUMNS = "status, failure_code, created_at, finished_at";

/** Invitations, newest first, each with its latest email attempt (one query). */
export async function listInvitations(): Promise<InvitationListRow[]> {
  if (!(await getAdminViewer())) throw new NotAdminError();

  const db = createSupabaseAdminClient();
  const withDeliveries = await db
    .from("invitations")
    .select(`${COLUMNS}, invitation_email_deliveries(${DELIVERY_COLUMNS})`)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "invitation_email_deliveries", ascending: false })
    .limit(1, { referencedTable: "invitation_email_deliveries" })
    .limit(500);

  if (!withDeliveries.error) {
    return withDeliveries.data.map(({ invitation_email_deliveries: deliveries, ...row }) => ({
      ...(row as InvitationRow),
      deliveries: deliveries ?? [],
    }));
  }

  // The delivery log may not exist yet while a release rolls out (the app can
  // deploy before its migration is applied). Membership management must keep
  // working, so fall back to the invitations alone.
  const { data, error } = await db
    .from("invitations")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Could not load invitations.");
  return (data ?? []).map((row) => ({ ...(row as InvitationRow), deliveries: [] }));
}

/**
 * Whether invitation emails can be sent from this deployment: a Resend key and
 * sender, and a trusted public origin for the sign-in link. Server only; the
 * key itself never leaves this module.
 */
export function invitationEmailReady(): boolean {
  return readEmailConfig() !== null && trustedLoginUrl() !== null;
}

export type SendInvitationEmailResult = DeliveryOutcome | { kind: "not_configured" };

/**
 * Sends (or re-sends) the invitation email for one invitation. Admins only;
 * the recipient is always the invitation's own stored address, never input.
 */
export async function sendInvitationEmail(rawId: unknown): Promise<SendInvitationEmailResult> {
  const admin = await getAdminViewer();
  if (!admin) throw new NotAdminError();

  const id = invitationIdSchema.safeParse(rawId);
  if (!id.success) return { kind: "refused", reason: "not_found" };

  const config = readEmailConfig();
  const loginUrl = trustedLoginUrl();
  if (!config || !loginUrl) return { kind: "not_configured" };

  const outcome = await deliverInvitationEmail({
    db: createSupabaseAdminClient(),
    invitationId: id.data,
    requestedBy: admin.userId,
    loginUrl,
    transport: createResendTransport(config),
  });
  if (outcome.kind === "failed" || outcome.kind === "error") {
    // Operational signal only: no address, key or provider response.
    console.error("invitation email not sent", { invitationId: id.data, outcome: outcome.kind, code: "code" in outcome ? outcome.code : undefined });
  }
  return outcome;
}

export async function createInvitation(rawEmail: unknown): Promise<MutationResult> {
  const admin = await getAdminViewer();
  if (!admin) throw new NotAdminError();

  const email = invitationEmailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, message: "Enter a valid email address." };

  const { data, error } = await createSupabaseAdminClient()
    .from("invitations")
    .insert({ email: email.data, invited_by: admin.userId })
    .select("id")
    .single();

  if (!error) return { ok: true, id: data.id };
  if (error.code === "23505") {
    return { ok: false, message: "That email address already has an invitation." };
  }
  return { ok: false, message: "The invitation could not be created." };
}

/** Admins can never be revoked, including by another admin or themselves. */
export function protectedUserIds(adminId: string): Set<string> {
  const ids = new Set(parseAdminUserIds(process.env.TRAINGRID_ADMIN_USER_IDS));
  ids.add(adminId.toLowerCase());
  return ids;
}

/**
 * Revokes a pending invitation, or an accepted member's access. In the second
 * case the member's data is kept; inviting the same email again restores it.
 * Both happen in one database transaction.
 */
export async function revokeInvitation(rawId: unknown): Promise<MutationResult> {
  const admin = await getAdminViewer();
  if (!admin) throw new NotAdminError();

  const id = invitationIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, message: "Unknown invitation." };

  const { data, error } = await createSupabaseAdminClient().rpc("revoke_invitation", {
    p_invitation_id: id.data,
    p_protected_user_ids: [...protectedUserIds(admin.userId)],
  });

  if (error) return { ok: false, message: "The invitation could not be revoked." };
  switch (data) {
    case "revoked":
      return { ok: true };
    case "protected":
      return { ok: false, message: "An admin's access cannot be revoked." };
    case "already_revoked":
      return { ok: false, message: "That invitation is already revoked." };
    default:
      return { ok: false, message: "Unknown invitation." };
  }
}
