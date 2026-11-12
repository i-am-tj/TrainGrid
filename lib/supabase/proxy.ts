import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isApiPath, isPublicPath, loginPathFor } from "@/lib/auth/routes";
import { getSupabaseEnv } from "./env";

/**
 * Runs on every request. It does two things:
 *
 *   1. refreshes the Supabase session and writes rotated auth cookies onto
 *      the response;
 *   2. keeps anonymous visitors away from private routes.
 *
 * This is the outer door only. It checks that there is a valid session, not
 * that the user is a member or may see a particular record: every page,
 * server action and data query checks that again for itself, and Row Level
 * Security enforces it in the database.
 *
 * It fails closed. If Supabase is not configured, or the session cannot be
 * verified, private routes are not served.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  let env;
  try {
    env = getSupabaseEnv();
  } catch {
    env = null;
  }
  if (!env) {
    return isPublic ? NextResponse.next({ request }) : deny(request, pathname, search);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that carry auth cookies must never be cached.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Verifies the token and refreshes it when it has expired. Do not add code
  // between creating the client and this call.
  let authenticated = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    authenticated = !error && typeof data?.claims?.sub === "string" && data.claims.sub !== "";
  } catch {
    authenticated = false;
  }

  if (isPublic || authenticated) return response;

  // Keep any cookie changes (for example a cleared, expired session).
  const denied = deny(request, pathname, search);
  for (const cookie of response.cookies.getAll()) {
    denied.cookies.set(cookie);
  }
  return denied;
}

function deny(request: NextRequest, pathname: string, search: string): NextResponse {
  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  const url = request.nextUrl.clone();
  const target = new URL(loginPathFor(pathname, search), url.origin);
  url.pathname = target.pathname;
  url.search = target.search;
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
