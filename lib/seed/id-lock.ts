import { readFileSync, existsSync } from "fs";
import path from "path";
import type { SeedRoutine } from "./convert-template";

/**
 * Seed item id lock (E2-D11).
 *
 * Every GLOBAL workout item has a fixed id, and scheduled sessions record the
 * id of the item they were copied from (provenance, and the future exercise
 * identity, D-04B). So an id must never start to mean a different exercise.
 *
 * data/templates/seed-ids.json records, for every item id, the routine it
 * belongs to and the exercise name it had. `npm run seed:generate` compares
 * the templates with it and refuses:
 *   - a MOVE: an id whose old exercise now sits under another id in the same
 *     routine (an item was inserted, removed or reordered without a Key);
 *   - a RENAME or REMOVAL, unless the maintainer confirms it with a flag.
 * New ids are simply added. A unit test fails if the lock and the templates
 * disagree, so a forgotten `seed:generate` is caught in CI.
 */

export type IdLockEntry = { routine: string; name: string };
export type IdLock = Record<string, IdLockEntry>;

export const ID_LOCK_FILE = path.join(process.cwd(), "data", "templates", "seed-ids.json");

export function buildIdLock(routines: SeedRoutine[]): IdLock {
  const lock: IdLock = {};
  for (const routine of [...routines].sort((a, b) => a.slug.localeCompare(b.slug))) {
    for (const item of routine.items) lock[item.id] = { routine: routine.slug, name: item.name };
  }
  return lock;
}

export function readIdLock(file = ID_LOCK_FILE): IdLock {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IdLock) : {};
}

export function serializeIdLock(lock: IdLock): string {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

export type IdChange = { id: string; routine: string; was: string; now?: string };

export type IdComparison = {
  /** An existing id now names a different exercise that is really a shift: the old exercise still exists under another id, or the new one used to have another id. Never allowed. */
  moved: IdChange[];
  /** An existing id now names a different exercise (an in-place rename). Allowed with --accept-renames. */
  renamed: IdChange[];
  /** An existing id is gone. Allowed with --accept-removals. */
  removed: IdChange[];
  added: IdChange[];
};

export function compareWithIdLock(lock: IdLock, routines: SeedRoutine[]): IdComparison {
  const current = buildIdLock(routines);
  const result: IdComparison = { moved: [], renamed: [], removed: [], added: [] };
  for (const [id, was] of Object.entries(lock)) {
    const now = current[id];
    if (!now) {
      result.removed.push({ id, routine: was.routine, was: was.name });
    } else if (now.name !== was.name) {
      // A move, not a rename, if the old exercise still exists under another
      // id, or the exercise now here used to have another id.
      const oldNameElsewhere = Object.entries(current).some(
        ([otherId, entry]) => otherId !== id && entry.routine === was.routine && entry.name === was.name,
      );
      const newNameHadOtherId = Object.entries(lock).some(
        ([otherId, entry]) => otherId !== id && entry.routine === was.routine && entry.name === now.name,
      );
      (oldNameElsewhere || newNameHadOtherId ? result.moved : result.renamed).push({
        id,
        routine: was.routine,
        was: was.name,
        now: now.name,
      });
    }
  }
  for (const [id, now] of Object.entries(current)) {
    if (!lock[id]) result.added.push({ id, routine: now.routine, was: now.name });
  }
  return result;
}
