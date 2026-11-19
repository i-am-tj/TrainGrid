import "server-only";

import { z } from "zod";
import { getAdminViewer } from "@/lib/admin/guard";
import { NotAdminError, type MutationResult } from "@/lib/admin/invitations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Invite requests on the admin Invitations page. Admins only: each function
 * checks before the secret-key client is created.
 */

export type InviteRequestRow = {
  id: string;
  email: string;
  name: string | null;
  note: string | null;
  created_at: string;
};

/** Pending requests, oldest first (first come, first reviewed). */
export async function listPendingInviteRequests(): Promise<InviteRequestRow[]> {
  if (!(await getAdminViewer())) throw new NotAdminError();
  const { data, error } = await createSupabaseAdminClient()
    .from("invite_requests")
    .select("id, email, name, note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);
  // The table may not exist yet while a release rolls out: show no requests.
  if (error) return [];
  return data;
}

/** Declines a pending request. Nothing is sent to the person who asked. */
export async function dismissInviteRequest(rawId: unknown): Promise<MutationResult> {
  if (!(await getAdminViewer())) throw new NotAdminError();
  const id = z.uuid().safeParse(rawId);
  if (!id.success) return { ok: false, message: "That request no longer exists." };
  const { data, error } = await createSupabaseAdminClient()
    .from("invite_requests")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, message: "The request could not be dismissed." };
  if (data.length === 0) return { ok: false, message: "That request was already handled." };
  return { ok: true };
}
