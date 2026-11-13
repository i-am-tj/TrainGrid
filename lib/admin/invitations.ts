import "server-only";

import { parseAdminUserIds } from "@/lib/admin/access";
import { getAdminViewer } from "@/lib/admin/guard";
import {
  invitationEmailSchema,
  invitationIdSchema,
  type InvitationRow,
} from "@/lib/admin/invitation-model";
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

export type MutationResult = { ok: true } | { ok: false; message: string };

const COLUMNS = "id, email, created_at, accepted_at, accepted_by, revoked_at";

export async function listInvitations(): Promise<InvitationRow[]> {
  if (!(await getAdminViewer())) throw new NotAdminError();

  const { data, error } = await createSupabaseAdminClient()
    .from("invitations")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error("Could not load invitations.");
  return (data ?? []) as InvitationRow[];
}

export async function createInvitation(rawEmail: unknown): Promise<MutationResult> {
  const admin = await getAdminViewer();
  if (!admin) throw new NotAdminError();

  const email = invitationEmailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, message: "Enter a valid email address." };

  const client = createSupabaseAdminClient();

  // Supabase Auth would link a sign-in with this address to the user who
  // already has it on a linked identity, so the invitee would land in that
  // member's account (E2-D22). Refuse rather than create that trap.
  const conflict = await client.rpc("invitation_email_conflict", { p_email: email.data });
  if (conflict.error) return { ok: false, message: "The invitation could not be created." };
  if (conflict.data === true) {
    return {
      ok: false,
      message:
        "That address already signs in to an existing member's account (it is linked to their Google or GitHub sign-in), so it cannot be invited as a separate person.",
    };
  }

  const { error } = await client
    .from("invitations")
    .insert({ email: email.data, invited_by: admin.userId });

  if (!error) return { ok: true };
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
