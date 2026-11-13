import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The member's own sign-in identities (E2-D22). Everything runs as the member,
 * through functions that check membership and session approval themselves.
 */

export type SignInMethod = {
  id: string;
  provider: "google" | "github" | "email" | "other";
  email: string | null;
  linkedAt: string;
  approved: boolean;
  thisSession: boolean;
};

const identityIdSchema = z.string().uuid();

function provider(value: string): SignInMethod["provider"] {
  return value === "google" || value === "github" || value === "email" ? value : "other";
}

export async function listSignInMethods(): Promise<SignInMethod[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_my_identities");
  if (error) throw new Error("Could not load sign-in methods.");
  return (data ?? []).map((row) => ({
    id: row.identity_id,
    provider: provider(row.provider),
    email: row.email ?? null,
    linkedAt: row.linked_at,
    approved: row.approved,
    thisSession: row.this_session,
  }));
}

export type IdentityResult = "approved" | "removed" | "reauth" | "current" | "last" | "error";

export async function approveSignInMethod(rawId: unknown): Promise<IdentityResult> {
  const id = identityIdSchema.safeParse(rawId);
  if (!id.success) return "error";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("approve_my_identity", { p_identity_id: id.data });
  if (error) return "error";
  if (data === "approved") return "approved";
  if (data === "reauth_required") return "reauth";
  return "error";
}

/**
 * Unlinks one of the member's identities with Supabase Auth's own
 * unlinkIdentity() (needs Manual Linking enabled). The identity this session
 * was signed in with cannot be removed here, so a member never cuts off the
 * session they are using.
 */
export async function removeSignInMethod(rawId: unknown): Promise<IdentityResult> {
  const id = identityIdSchema.safeParse(rawId);
  if (!id.success) return "error";

  const methods = await listSignInMethods();
  const target = methods.find((m) => m.id === id.data);
  if (!target) return "error";
  if (target.thisSession) return "current";
  if (methods.length < 2) return "last";

  const supabase = await createSupabaseServerClient();
  const identities = await supabase.auth.getUserIdentities();
  const identity = identities.data?.identities.find((i) => i.identity_id === id.data);
  if (identities.error || !identity) return "error";

  const { error } = await supabase.auth.unlinkIdentity(identity);
  return error ? "error" : "removed";
}
