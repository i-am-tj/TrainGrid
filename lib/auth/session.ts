import "server-only";

import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer =
  | { status: "anonymous" }
  | { status: "not_member"; userId: string; email: string | null }
  // A member whose account has a linked identity on another email address.
  // Nothing is readable until it is removed (E2-D22).
  | { status: "locked"; userId: string; email: string | null }
  | { status: "member"; userId: string; email: string | null; displayName: string | null };

/**
 * Who is making this request.
 *
 * The user id comes from the verified session token, never from the request
 * body or URL. Membership is read through Row Level Security: a user can see
 * only their own profile row, so a row that comes back and is not revoked
 * means "this caller is a member".
 */
export async function getViewer(): Promise<Viewer> {
  if (!getSupabaseEnv()) return { status: "anonymous" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) return { status: "anonymous" };

  const rawEmail = data.claims.email;
  const email = typeof rawEmail === "string" && rawEmail ? rawEmail : null;

  // The database decides, from the session and the account's identities
  // (account_status(), E2-D22). Anything unexpected is treated as no access.
  const status = await supabase.rpc("account_status");
  if (status.error) return { status: "not_member", userId, email };
  if (status.data === "session_ended") return { status: "anonymous" };
  if (status.data === "identity_mismatch") return { status: "locked", userId, email };
  if (status.data !== "member") return { status: "not_member", userId, email };

  const profile = await supabase
    .from("profiles")
    .select("display_name, revoked_at")
    .eq("id", userId)
    .maybeSingle();

  if (profile.error || !profile.data || profile.data.revoked_at) {
    return { status: "not_member", userId, email };
  }

  const displayName = profile.data.display_name;
  return {
    status: "member",
    userId,
    email,
    displayName: typeof displayName === "string" && displayName ? displayName : null,
  };
}

export type Member = Extract<Viewer, { status: "member" }>;

/**
 * Returns the current member, or sends the request to /login.
 *
 * Call this at the top of every private page, server action and data
 * function. The proxy has usually already turned anonymous visitors away,
 * but nothing may rely on that: this is the check that counts, and it also
 * covers signed-in users who are not members.
 */
export async function requireMember(): Promise<Member> {
  const viewer = await getViewer();
  if (viewer.status === "locked") redirect("/account/sign-in-methods");
  if (viewer.status !== "member") redirect("/login");
  return viewer;
}

export type AccountOwner = Extract<Viewer, { status: "member" | "locked" }>;

/** A member, locked or not: the only people who may manage the account's sign-ins. */
export async function requireAccountOwner(): Promise<AccountOwner> {
  const viewer = await getViewer();
  if (viewer.status !== "member" && viewer.status !== "locked") redirect("/login");
  return viewer;
}
