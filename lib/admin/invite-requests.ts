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
  /** What happened to this address before: a member whose access was revoked, or a revoked invitation. */
  history: "former_member" | "revoked_invitation" | null;
};

/** Pending requests, oldest first (first come, first reviewed), with each address's history. */
export async function listPendingInviteRequests(): Promise<InviteRequestRow[]> {
  if (!(await getAdminViewer())) throw new NotAdminError();
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("invite_requests")
    .select("id, email, name, note, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);
  // The table may not exist yet while a release rolls out: show no requests.
  if (error || data.length === 0) return [];

  // Live invitations resolve requests (trigger), so any earlier one here is revoked.
  const earlier = await db
    .from("invitations")
    .select("email, accepted_at")
    .in("email", data.map((row) => row.email))
    .not("revoked_at", "is", null);
  const history = new Map<string, InviteRequestRow["history"]>();
  for (const row of earlier.data ?? []) {
    if (row.accepted_at) history.set(row.email, "former_member");
    else if (!history.has(row.email)) history.set(row.email, "revoked_invitation");
  }
  return data.map((row) => ({ ...row, history: history.get(row.email) ?? null }));
}

/** How many requests wait for review; 0 when unknown. For the header badge. */
export async function countPendingInviteRequests(): Promise<number> {
  if (!(await getAdminViewer())) return 0;
  const { count, error } = await createSupabaseAdminClient()
    .from("invite_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return error ? 0 : (count ?? 0);
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
