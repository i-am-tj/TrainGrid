/**
 * Regenerates supabase/seed.sql from data/templates/*.md.
 *
 *   npm run seed:generate
 *
 * Writes a file only. Applying it is a separate, deliberate step: it runs
 * automatically on `npm run db:reset` locally, and on production with
 * `npx supabase db push --remote --include-seed` (see supabase/README.md).
 */
import { writeFileSync } from "fs";
import { seedSql } from "../lib/seed/convert-template";
import { SEED_FILE, loadSeedRoutines } from "../lib/seed/templates";

const routines = loadSeedRoutines();
writeFileSync(SEED_FILE, seedSql(routines));
const items = routines.reduce((total, routine) => total + routine.items.length, 0);
console.log(`Wrote ${SEED_FILE}: ${routines.length} GLOBAL routines, ${items} items.`);
