import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { convertSection, convertTemplate, seedSql, uuidV5 } from "./convert-template";
import { SEED_FILE, TEMPLATES_DIR, loadSeedRoutines } from "./templates";

describe("uuidV5", () => {
  it("is deterministic, version 5 and namespace-dependent", () => {
    const id = uuidV5("routine:lower-a");
    expect(id).toBe(uuidV5("routine:lower-a"));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).not.toBe(uuidV5("routine:lower-b"));
  });

  it("matches the RFC 4122 test vector", () => {
    // uuid v5 of "www.example.com" in the DNS namespace.
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });
});

describe("convertSection", () => {
  it("splits a strength item into structured fields", () => {
    const item = convertSection(
      "lower-a",
      0,
      "Back Squat",
      "4 × 5–6\nRest: 2–3 min\nTarget: RPE 7–8\n\nControlled descent.\n\nEquipment: Barbell\n",
    );
    expect(item).toMatchObject({
      name: "Back Squat",
      instruction: "4 × 5–6",
      rest: "2–3 min",
      target: "RPE 7–8",
      notes: "Controlled descent.",
      equipment: ["barbell"],
      videoUrl: null,
    });
  });

  it("treats Intensity as the target and keeps multi-line instructions", () => {
    const item = convertSection(
      "tempo-run",
      1,
      "Main",
      "20 min tempo\nEven breathing.\n\nIntensity: RPE 6–7 / 10\n",
    );
    expect(item.instruction).toBe("20 min tempo\nEven breathing.");
    expect(item.target).toBe("RPE 6–7 / 10");
    expect(item.notes).toBe("");
  });

  it("keeps YouTube links and drops anything else", () => {
    expect(convertSection("x", 0, "A", "Video: https://youtu.be/abcdefghijk").videoUrl).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
    expect(convertSection("x", 0, "A", "Video: https://example.com/clip").videoUrl).toBeNull();
  });

  it("merges several equipment lines and keeps canonical order", () => {
    expect(
      convertSection("x", 0, "A", "Equipment: Bench\nEquipment: Dumbbell, Bench").equipment,
    ).toEqual(["dumbbell", "bench"]);
  });
});

describe("convertTemplate", () => {
  it("rejects templates that cannot become valid routines", () => {
    expect(() => convertTemplate("x", "---\nname: X\ntype: yoga\n---\n")).toThrow(/unknown type/);
    expect(() => convertTemplate("x", "---\ntype: other\n---\n")).toThrow(/missing name/);
    expect(() => convertTemplate("Bad Slug", "---\nname: X\ntype: other\n---\n")).toThrow(/invalid slug/);
  });
});

describe("every template in data/templates", () => {
  const files = readdirSync(TEMPLATES_DIR).filter((file) => file.endsWith(".md"));
  const routines = loadSeedRoutines();

  it("converts all 18 templates", () => {
    expect(files).toHaveLength(18);
    expect(routines).toHaveLength(18);
  });

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const markdown = readFileSync(path.join(TEMPLATES_DIR, file), "utf8");
    const routine = routines.find((candidate) => candidate.slug === slug)!;

    it(`${slug}: keeps every section, in order, with nothing left behind`, () => {
      const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]!.trim());
      expect(routine.items.map((item) => item.name)).toEqual(headings);

      for (const item of routine.items) {
        for (const text of [item.instruction, item.notes]) {
          expect(text).not.toMatch(/^\s*(rest|target|intensity|equipment|video)\s*:/im);
        }
      }

      const count = (pattern: RegExp) => (markdown.match(pattern) ?? []).length;
      expect(routine.items.filter((item) => item.rest).length).toBe(count(/^Rest:/gm));
      expect(routine.items.filter((item) => item.target).length).toBe(
        count(/^(Target|Intensity):/gm),
      );
      expect(routine.items.filter((item) => item.equipment.length > 0).length).toBe(
        count(/^Equipment:/gm),
      );
      expect(routine.items.filter((item) => item.videoUrl).length).toBe(count(/^Video:/gm));
    });
  }

  it("gives every routine and item a unique id", () => {
    const ids = routines.flatMap((routine) => [routine.id, ...routine.items.map((item) => item.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("supabase/seed.sql is up to date with the templates (run npm run seed:generate)", () => {
    expect(readFileSync(SEED_FILE, "utf8")).toBe(seedSql(routines));
  });

  it("the seed contains only generic content", () => {
    const text = readFileSync(SEED_FILE, "utf8");
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/PERSONAL/);
    expect(text).not.toMatch(/scheduled_sessions|profiles|invitations/);
  });
});
