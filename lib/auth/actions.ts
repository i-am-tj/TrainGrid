"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isOAuthProviderId } from "@/lib/auth/providers";
import { buildCallbackUrl, originFromHeaders, safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Starts an OAuth sign-in. The browser is sent to the provider through
 * Supabase and comes back to /auth/callback with a one-time code.
 */
export async function signInWithProvider(formData: FormData) {
  const provider = formData.get("provider");
  if (!isOAuthProviderId(provider) || !getSupabaseEnv()) {
    redirect("/login?error=signin");
  }

  const nextPath = safeNextPath(formData.get("next"));
  const origin = originFromHeaders(await headers());
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: buildCallbackUrl(origin, nextPath) },
  });

  if (error || !data.url) {
    redirect("/login?error=signin");
  }
  redirect(data.url);
}

/** Ends the session on this device and returns to the sign-in page. */
export async function signOut() {
  if (getSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/login");
}
