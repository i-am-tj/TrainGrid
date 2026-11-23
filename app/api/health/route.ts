import { NextResponse } from "next/server";
import { fetchSchemaShape, isBehind, schemaGap, type SchemaShape, type SchemaStatus } from "@/lib/release/schema";
import manifest from "@/lib/release/schema-manifest.json";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type Health = {
  supabase: "ok" | "unconfigured" | "unreachable";
  /**
   * Whether the database has every table, column and function this build
   * uses. "behind" means a migration is missing: Auth answers but the planner
   * would fail (PRODUCT_AUDIT F1). "unknown" when it could not be checked
   * (no secret key on this deployment, or the Data API did not answer).
   */
  schema?: SchemaStatus;
};

/** One schema read per server instance per interval keeps the check cheap. */
const SCHEMA_TTL_MS = 5 * 60_000;
let schemaCache: { at: number; status: SchemaStatus } | null = null;

/**
 * Reports whether this deployment can reach its Supabase project and whether
 * that project's database matches this build.
 *
 * Public by design and deliberately uninformative: it returns a word or two
 * and never the project URL, a key, an upstream error message or which part
 * of the schema is missing (`npm run release:check` says that, for the owner).
 * 503 when Supabase is unreachable or the schema is behind, so an uptime
 * monitor or the release smoke test catches both.
 */
export async function GET() {
  const body = await check();
  const healthy = body.supabase === "ok" && body.schema !== "behind";
  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
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
    if (!response.ok) return { supabase: "unreachable" };
  } catch {
    return { supabase: "unreachable" };
  }
  return { supabase: "ok", schema: await schemaStatus(env.url) };
}

async function schemaStatus(url: string): Promise<SchemaStatus> {
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey || secretKey.startsWith("sb_publishable_")) return "unknown";
  if (schemaCache && Date.now() - schemaCache.at < SCHEMA_TTL_MS) return schemaCache.status;

  let status: SchemaStatus;
  try {
    const actual = await fetchSchemaShape(url, secretKey);
    status = isBehind(schemaGap(manifest as SchemaShape, actual)) ? "behind" : "ok";
  } catch {
    // Not cached: the next request tries again.
    return "unknown";
  }
  schemaCache = { at: Date.now(), status };
  if (status === "behind") console.error(JSON.stringify({ event: "schema_behind", at: new Date().toISOString() }));
  return status;
}
