/**
 * One-time import of a file-era schedule into ONE member's calendar (story 16).
 *
 *   npx tsx scripts/import-legacy-schedule.ts --file data/schedule.json --user <uuid>          (dry run)
 *   npx tsx scripts/import-legacy-schedule.ts --file data/schedule.json --user <uuid> --apply
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment.
 * Run it on your own machine only; it is not part of the app and has no route.
 * The secret key is used directly and never printed.
 *
 * Safety:
 *   - dry run unless --apply is given;
 *   - the target user must already be an active member;
 *   - sessions whose id already exists are skipped, so a re-run adds nothing.
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { parseLegacySchedule, planImport, type RoutineForImport } from "../lib/legacy/schedule-import";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const file = arg("--file");
  const userId = arg("--user");
  const apply = process.argv.includes("--apply");
  if (!file || !userId) {
    throw new Error("Usage: --file <schedule.json> --user <member uuid> [--apply]");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");

  const db = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Target project: ${new URL(url).host}`);
  console.log(`Target member:  ${userId}`);

  const profile = await db.from("profiles").select("id, revoked_at").eq("id", userId).maybeSingle();
  if (profile.error) throw new Error(`Could not check the member: ${profile.error.message}`);
  if (!profile.data || profile.data.revoked_at) {
    throw new Error("That user is not an active member. Sign in once with an invited account first.");
  }

  const sessions = parseLegacySchedule(readFileSync(file, "utf8"));
  const routines = await db
    .from("routines")
    .select("id, slug, workout_items(id, name, instruction, rest, target, notes, equipment, video_url, sort_order)")
    .eq("scope", "GLOBAL")
    .not("slug", "is", null)
    .order("sort_order", { referencedTable: "workout_items" });
  if (routines.error) throw new Error(`Could not load GLOBAL routines: ${routines.error.message}`);

  const forImport: RoutineForImport[] = routines.data.map((routine) => ({
    id: routine.id,
    slug: routine.slug!,
    items: routine.workout_items,
  }));
  const plan = planImport(sessions, userId, forImport);

  console.log(`Sessions in file: ${sessions.length}`);
  for (const warning of plan.warnings) console.log(`Warning: ${warning}`);
  if (plan.rows.length === 0) {
    console.log("Nothing to import.");
    return;
  }
  if (!apply) {
    console.log(`Dry run: would import ${plan.rows.length} session(s). Re-run with --apply.`);
    return;
  }

  const { data, error } = await db
    .from("scheduled_sessions")
    .upsert(
      plan.rows.map((row) => ({ ...row, snapshot: row.snapshot as unknown as Database["public"]["Tables"]["scheduled_sessions"]["Insert"]["snapshot"] })),
      { onConflict: "id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`Import failed: ${error.message}`);
  console.log(`Imported ${data.length} session(s); ${plan.rows.length - data.length} already present.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
