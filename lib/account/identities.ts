import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The account's sign-in identities (E2-D22). Read from Supabase Auth's own
 * account API, which works even while the account is locked, so the owner can
 * always see and fix what is linked.
 *
 * The rule: every identity must carry the account's canonical email, the
 * address the invitation was accepted for. Any other identity locks the whole
 * account until it is removed.
 */

export type SignInMethod = {
  id: string;
  provider: "google" | "github" | "email" | "other";
  email: string | null;
  linkedAt: string | null;
  matches: boolean;
};

const identityIdSchema = z.string().uuid();

function provider(value: string): SignInMethod["provider"] {
  return value === "google" || value === "github" || value === "email" ? value : "other";
}

const normalise = (email: unknown) => (typeof email === "string" ? email.trim().toLowerCase() : "");

export async function accountSignIns(): Promise<{ canonicalEmail: string | null; methods: SignInMethod[] }> {
  const supabase = await createSupabaseServerClient();
  const [canonical, identities] = await Promise.all([
    supabase.rpc("my_canonical_email"),
    supabase.auth.getUserIdentities(),
  ]);
  if (canonical.error || identities.error) throw new Error("Could not load sign-in methods.");
  const canonicalEmail = typeof canonical.data === "string" ? canonical.data : null;
  const methods = (identities.data?.identities ?? []).map((i) => {
    const email = normalise(i.identity_data?.email) || null;
    return {
      id: i.identity_id,
      provider: provider(i.provider),
      email,
      linkedAt: i.created_at ?? null,
      matches: !!canonicalEmail && email === canonicalEmail,
    };
  });
  return { canonicalEmail, methods };
}

export type AccountResult = "removed" | "kept" | "signed_out" | "manual_linking_off" | "error";

/**
 * Removes an identity on another address with Supabase Auth's
 * unlinkIdentity(). Identities on the canonical email are never removed here,
 * so this page can only take the account back towards the rule. Needs Manual
 * Linking, which production turns on only during a supervised cleanup.
 */
export async function removeMismatchedSignIn(rawId: unknown): Promise<AccountResult> {
  const id = identityIdSchema.safeParse(rawId);
  if (!id.success) return "error";

  const { methods } = await accountSignIns();
  const target = methods.find((m) => m.id === id.data);
  if (!target) return "error";
  if (target.matches) return "kept";

  const supabase = await createSupabaseServerClient();
  const identities = await supabase.auth.getUserIdentities();
  const identity = identities.data?.identities.find((i) => i.identity_id === id.data);
  if (identities.error || !identity) return "error";

  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (!error) return "removed";
  return error.code === "manual_linking_disabled" ? "manual_linking_off" : "error";
}

/** Ends every other session of this account; their access tokens stop working at once. */
export async function signOutOtherDevices(): Promise<AccountResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  return error ? "error" : "signed_out";
}
