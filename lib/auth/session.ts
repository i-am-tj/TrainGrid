import "server-only";

import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer =
  | { status: "anonymous" }
  | { status: "not_member"; userId: string; email: string | null }
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

  const profile = await supabase
    .from("profiles")
    .select("display_name, revoked_at")
    .eq("id", userId)
    .maybeSingle();

  // A revoked member is treated exactly like someone who was never invited.
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
  if (viewer.status !== "member") redirect("/login");
  return viewer;
}
