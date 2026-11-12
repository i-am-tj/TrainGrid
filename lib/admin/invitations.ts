import "server-only";

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

const COLUMNS = "id, email, created_at, accepted_at, revoked_at";

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

  const { error } = await createSupabaseAdminClient()
    .from("invitations")
    .insert({ email: email.data, invited_by: admin.userId });

  if (!error) return { ok: true };
  if (error.code === "23505") {
    return { ok: false, message: "That email address already has an invitation." };
  }
  return { ok: false, message: "The invitation could not be created." };
}

export async function revokeInvitation(rawId: unknown): Promise<MutationResult> {
  if (!(await getAdminViewer())) throw new NotAdminError();

  const id = invitationIdSchema.safeParse(rawId);
  if (!id.success) return { ok: false, message: "Unknown invitation." };

  // Only an unused, live invitation can be revoked.
  const { data, error } = await createSupabaseAdminClient()
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id.data)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");

  if (error) return { ok: false, message: "The invitation could not be revoked." };
  if (!data || data.length === 0) {
    return { ok: false, message: "Only a pending invitation can be revoked." };
  }
  return { ok: true };
}
