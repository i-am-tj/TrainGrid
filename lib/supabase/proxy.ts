import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session for a request and writes any rotated auth
 * cookies onto the response.
 *
 * This only keeps the session fresh. It does not decide who may see what:
 * route protection is added separately, and every server-side data function
 * authenticates on its own regardless of what happens here.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  // Until Supabase is configured for a deployment there is no session to
  // refresh. Nothing is protected by this function, so passing through is safe.
  if (!env) return response;

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
  await supabase.auth.getClaims();

  return response;
}
