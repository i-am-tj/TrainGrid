import { NextResponse, type NextRequest } from "next/server";
import { loginErrorForInvite } from "@/lib/auth/invite";
import { classifyCallbackError } from "@/lib/auth/providers";
import { originFromHeaders, safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth return leg. Supabase redirects here with a one-time `code`, which is
 * exchanged for a session stored in cookies.
 *
 * A session alone grants nothing. Before anyone is let in, the database checks
 * the user's verified email against the invitations and, on a match, makes
 * them a member. Everyone else is signed out again straight away.
 *
 * Any failure lands on /login with one of a fixed set of messages. Provider
 * and authorization details are never echoed back to the page.
 */
export async function GET(request: NextRequest) {
  const origin = originFromHeaders(request.headers);
  const params = request.nextUrl.searchParams;
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${code}`, origin));

  const code = params.get("code");
  if (!code || !getSupabaseEnv()) return fail(classifyCallbackError(params));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  // The access token hook refuses unapproved linked identities (E2-D22); no
  // session exists in that case. Any other failure stays generic.
  if (error) return fail(error.message === "identity_not_approved" ? "linked" : "signin");

  // Invite-only gate. The decision is made inside the database from the
  // caller's own identity; nothing from the request influences it.
  const invite = await supabase.rpc("accept_invitation");
  const refusal = invite.error ? "signin" : loginErrorForInvite(invite.data);
  if (refusal) {
    await supabase.auth.signOut({ scope: "local" });
    return fail(refusal);
  }

  const nextPath = safeNextPath(params.get("next"));
  return NextResponse.redirect(new URL(nextPath, origin));
}
