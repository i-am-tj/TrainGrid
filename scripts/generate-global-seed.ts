/**
 * Regenerates supabase/seed.sql and data/templates/seed-ids.json from
 * data/templates/*.md.
 *
 *   npm run seed:generate
 *   npm run seed:generate -- --accept-renames     # an exercise was renamed in place
 *   npm run seed:generate -- --accept-removals    # an item was deliberately removed
 *
 * Writes files only. Applying the seed is a separate, deliberate step: it runs
 * automatically on `npm run db:reset` locally, and on production only with
 * `npx supabase db push --remote --include-seed` (docs/CONTENT.md).
 *
 * Item ids must never move to a different exercise (E2-D11). If a change
 * would do that, nothing is written and the problem is printed.
 */
import { writeFileSync } from "fs";
import { seedSql } from "../lib/seed/convert-template";
import { buildIdLock, compareWithIdLock, ID_LOCK_FILE, readIdLock, serializeIdLock } from "../lib/seed/id-lock";
import { SEED_FILE, loadSeedRoutines } from "../lib/seed/templates";

const args = new Set(process.argv.slice(2));
const routines = loadSeedRoutines();
const changes = compareWithIdLock(readIdLock(), routines);

const describe = (c: { routine: string; was: string; now?: string; id: string }) =>
  `  ${c.routine}: "${c.was}"${c.now ? ` → "${c.now}"` : ""}  (${c.id})`;

let refused = false;
if (changes.moved.length > 0) {
  refused = true;
  console.error(
    "Refused: these item ids would point at a different exercise, because items were inserted,\n" +
      "removed or reordered without a Key. Give new items a word Key (Key: hip-thrust) and pin\n" +
      "moved existing items to their original position (Key: 3). See docs/CONTENT.md.",
  );
  changes.moved.forEach((c) => console.error(describe(c)));
}
if (changes.renamed.length > 0 && !args.has("--accept-renames")) {
  refused = true;
  console.error("Refused: these items were renamed in place. If that is intended, run again with --accept-renames.");
  changes.renamed.forEach((c) => console.error(describe(c)));
}
if (changes.removed.length > 0 && !args.has("--accept-removals")) {
  refused = true;
  console.error("Refused: these items were removed. If that is intended, run again with --accept-removals.");
  changes.removed.forEach((c) => console.error(describe(c)));
}
if (refused) {
  console.error("Nothing was written.");
  process.exit(1);
}

writeFileSync(SEED_FILE, seedSql(routines));
writeFileSync(ID_LOCK_FILE, serializeIdLock(buildIdLock(routines)));
const items = routines.reduce((total, routine) => total + routine.items.length, 0);
console.log(`Wrote ${SEED_FILE}: ${routines.length} GLOBAL routines, ${items} items.`);
console.log(
  `Wrote ${ID_LOCK_FILE}: ${changes.added.length} new, ${changes.renamed.length} renamed, ${changes.removed.length} removed.`,
);
