import { NextResponse, type NextRequest } from "next/server";
import { classifyCallbackError } from "@/lib/auth/providers";
import { originFromHeaders, safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth return leg. Supabase redirects here with a one-time `code`, which is
 * exchanged for a session stored in cookies.
 *
 * Any failure lands on /login with one of a fixed set of messages. Provider
 * error details are never echoed back to the page.
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
  if (error) return fail("signin");

  const nextPath = safeNextPath(params.get("next"));
  return NextResponse.redirect(new URL(nextPath, origin));
}
