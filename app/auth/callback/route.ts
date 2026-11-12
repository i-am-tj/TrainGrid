import { NextResponse, type NextRequest } from "next/server";
import { originFromHeaders, safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth return leg. Supabase redirects here with a one-time `code`, which is
 * exchanged for a session stored in cookies.
 *
 * Any failure lands on /login with a generic message. Provider error details
 * are never echoed back to the page.
 */
export async function GET(request: NextRequest) {
  const origin = originFromHeaders(request.headers);
  const failure = NextResponse.redirect(new URL("/login?error=signin", origin));

  const code = request.nextUrl.searchParams.get("code");
  if (!code || !getSupabaseEnv()) return failure;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failure;

  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(nextPath, origin));
}
