import "server-only";

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
 * only their own profile row, so a row coming back means "this caller is a
 * member".
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
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  if (profile.error || !profile.data) return { status: "not_member", userId, email };

  const displayName = profile.data.display_name;
  return {
    status: "member",
    userId,
    email,
    displayName: typeof displayName === "string" && displayName ? displayName : null,
  };
}
