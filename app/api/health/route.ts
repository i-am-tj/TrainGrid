import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type Health = { supabase: "ok" | "unconfigured" | "unreachable" };

/**
 * Reports whether this deployment can reach its Supabase project.
 *
 * Public by design and deliberately uninformative: it returns one word and
 * never the project URL, a key, or an upstream error message.
 */
export async function GET() {
  const body = await check();
  return NextResponse.json(body, {
    status: body.supabase === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

async function check(): Promise<Health> {
  let env;
  try {
    env = getSupabaseEnv();
  } catch {
    return { supabase: "unconfigured" };
  }
  if (!env) return { supabase: "unconfigured" };

  try {
    const response = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return { supabase: response.ok ? "ok" : "unreachable" };
  } catch {
    return { supabase: "unreachable" };
  }
}
