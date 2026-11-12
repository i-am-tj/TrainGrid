import { readdirSync, readFileSync } from "fs";
import path from "path";
import { convertTemplate, type SeedRoutine } from "./convert-template";

export const TEMPLATES_DIR = path.join(process.cwd(), "data", "templates");
export const SEED_FILE = path.join(process.cwd(), "supabase", "seed.sql");

/** Converts every template file, sorted by slug so the output is stable. */
export function loadSeedRoutines(dir = TEMPLATES_DIR): SeedRoutine[] {
  const routines = readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => convertTemplate(file.replace(/\.md$/, ""), readFileSync(path.join(dir, file), "utf8")));
  const slugs = new Set<string>();
  for (const routine of routines) {
    if (slugs.has(routine.slug)) throw new Error(`Duplicate template slug "${routine.slug}"`);
    slugs.add(routine.slug);
  }
  return routines.sort((a, b) => a.slug.localeCompare(b.slug));
}
