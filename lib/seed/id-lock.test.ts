import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { convertTemplate, uuidV5 } from "./convert-template";
import { buildIdLock, compareWithIdLock, ID_LOCK_FILE, readIdLock, serializeIdLock } from "./id-lock";
import { loadSeedRoutines } from "./templates";

/** Seed item id stability (Epic 2, E2-06 / E2-D11). */

const template = (sections: string[]) =>
  `---\nid: demo\nname: Demo\ntype: strength\n---\n\n${sections.map((s) => `## ${s}\n\n3 × 5\n`).join("\n")}`;
const withKey = (name: string, key: string) => `${name}\n\nKey: ${key}`;

const original = convertTemplate("demo", template(["Squat", "Bench", "Row"]));
const lock = buildIdLock([original]);

describe("item keys", () => {
  it("without a Key, ids come from the position, exactly as before", () => {
    expect(original.items.map((item) => item.id)).toEqual([0, 1, 2].map((i) => uuidV5(`routine-item:demo:${i}`)));
  });

  it("a word Key gives an id that does not depend on position", () => {
    const first = convertTemplate("demo", template([withKey("Lunge", "lunge"), "Squat"]));
    const later = convertTemplate("demo", template(["Squat", "Bench", withKey("Lunge", "lunge")]));
    expect(first.items[0]!.id).toBe(uuidV5("routine-item:demo:key:lunge"));
    expect(later.items[2]!.id).toBe(first.items[0]!.id);
  });

  it("a number Key pins an existing item to its original position's id", () => {
    const reordered = convertTemplate("demo", template([withKey("Row", "2"), withKey("Squat", "0"), withKey("Bench", "1")]));
    expect(reordered.items.map((item) => item.id)).toEqual([original.items[2]!.id, original.items[0]!.id, original.items[1]!.id]);
  });

  it("Key lines are not content", () => {
    const routine = convertTemplate("demo", template([withKey("Lunge", "lunge")]));
    expect(routine.items[0]!.instruction).toBe("3 × 5");
    expect(routine.items[0]!.notes).toBe("");
  });

  it("rejects bad, repeated or colliding keys", () => {
    expect(() => convertTemplate("demo", template([withKey("Lunge", "Bad Key")]))).toThrow(/invalid Key/);
    expect(() => convertTemplate("demo", template([withKey("A", "x"), withKey("B", "x")]))).toThrow(/share an id/);
    // "Key: 1" on the first item collides with the second item's position id.
    expect(() => convertTemplate("demo", template([withKey("A", "1"), "B"]))).toThrow(/share an id/);
    expect(() => convertTemplate("demo", template(["A\n\nKey: a\nKey: b"]))).toThrow(/more than one Key/);
  });
});

describe("the id lock refuses ids that would change exercise", () => {
  it("inserting an item without a Key moves ids: refused", () => {
    const routine = convertTemplate("demo", template(["Squat", "Lunge", "Bench", "Row"]));
    const result = compareWithIdLock(lock, [routine]);
    expect(result.moved.map((c) => [c.was, c.now])).toEqual([
      ["Bench", "Lunge"],
      ["Row", "Bench"],
    ]);
  });

  it("inserting with a word Key: existing ids keep their exercise; only an addition", () => {
    const routine = convertTemplate("demo", template(["Squat", withKey("Lunge", "lunge"), withKey("Bench", "1"), withKey("Row", "2")]));
    const result = compareWithIdLock(lock, [routine]);
    expect(result).toMatchObject({ moved: [], renamed: [], removed: [] });
    expect(result.added.map((c) => c.was)).toEqual(["Lunge"]);
  });

  it("removing a middle item without pinning the rest is refused; pinning makes it a plain removal", () => {
    const shifted = convertTemplate("demo", template(["Squat", "Row"]));
    expect(compareWithIdLock(lock, [shifted]).moved.map((c) => c.was)).toEqual(["Bench"]);

    const pinned = convertTemplate("demo", template(["Squat", withKey("Row", "2")]));
    const result = compareWithIdLock(lock, [pinned]);
    expect(result.moved).toEqual([]);
    expect(result.removed.map((c) => c.was)).toEqual(["Bench"]);
  });

  it("reordering with number Keys changes nothing about ids", () => {
    const routine = convertTemplate("demo", template([withKey("Row", "2"), withKey("Squat", "0"), withKey("Bench", "1")]));
    expect(compareWithIdLock(lock, [routine])).toEqual({ moved: [], renamed: [], removed: [], added: [] });
  });

  it("an in-place rename is reported as a rename (needs --accept-renames), not a move", () => {
    const routine = convertTemplate("demo", template(["Back Squat", "Bench", "Row"]));
    const result = compareWithIdLock(lock, [routine]);
    expect(result.moved).toEqual([]);
    expect(result.renamed.map((c) => [c.was, c.now])).toEqual([["Squat", "Back Squat"]]);
  });

  it("appending at the end is a plain addition, as before", () => {
    const routine = convertTemplate("demo", template(["Squat", "Bench", "Row", "Curl"]));
    const result = compareWithIdLock(lock, [routine]);
    expect(result).toMatchObject({ moved: [], renamed: [], removed: [] });
    expect(result.added.map((c) => c.was)).toEqual(["Curl"]);
  });
});

describe("the committed id lock", () => {
  const routines = loadSeedRoutines();

  it("data/templates/seed-ids.json is up to date with the templates (run npm run seed:generate)", () => {
    expect(readFileSync(ID_LOCK_FILE, "utf8")).toBe(serializeIdLock(buildIdLock(routines)));
  });

  it("records every one of the 96 seeded items, none moved", () => {
    const result = compareWithIdLock(readIdLock(), routines);
    expect(Object.keys(readIdLock())).toHaveLength(96);
    expect(result).toEqual({ moved: [], renamed: [], removed: [], added: [] });
  });
});
