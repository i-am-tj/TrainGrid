import { describe, expect, it } from "vitest";
import type { LibraryRoutine } from "@/lib/data/model";
import {
  applyLibraryQuery,
  DEFAULT_LIBRARY_QUERY,
  hasFilters,
  inScope,
  matchesSearch,
  MAX_SEARCH_LENGTH,
  normalizeSearch,
  libraryEmptyState,
  libraryHref,
  parseLibraryQuery,
} from "./query";

const routine = (over: Partial<LibraryRoutine>): LibraryRoutine => ({
  id: "id",
  scope: "GLOBAL",
  isOwn: false,
  slug: null,
  name: "Routine",
  category: "strength",
  description: "",
  itemNames: [],
  equipment: [],
  itemCount: 0,
  ...over,
});

const lowerA = routine({ id: "g1", name: "Lower A", category: "strength", slug: "lower-a" });
const easyRun = routine({ id: "g2", name: "Easy Run", category: "running", slug: "easy-run" });
const mine = routine({ id: "p1", scope: "PERSONAL", isOwn: true, name: "My Lift", category: "strength" });
// RLS never returns another member's routine; if one ever appeared, no view may show it.
const foreign = routine({ id: "x1", scope: "PERSONAL", isOwn: false, name: "Someone else's" });
const all = [lowerA, easyRun, mine, foreign];

describe("parseLibraryQuery", () => {
  it("defaults to All with no category", () => {
    expect(parseLibraryQuery({})).toEqual(DEFAULT_LIBRARY_QUERY);
  });

  it("reads scope and type", () => {
    expect(parseLibraryQuery({ scope: "global", type: "strength" })).toEqual({
      ...DEFAULT_LIBRARY_QUERY,
      scope: "global",
      type: "strength",
    });
    expect(parseLibraryQuery({ scope: "mine" })).toEqual({ ...DEFAULT_LIBRARY_QUERY, scope: "mine" });
  });

  it("keeps existing ?type= links working", () => {
    expect(parseLibraryQuery({ type: "plyometrics" })).toEqual({ ...DEFAULT_LIBRARY_QUERY, type: "plyometrics" });
  });

  it("tolerates case and surrounding spaces", () => {
    expect(parseLibraryQuery({ scope: " Global ", type: "RUNNING" })).toEqual({
      ...DEFAULT_LIBRARY_QUERY,
      scope: "global",
      type: "running",
    });
  });

  it("falls back per parameter for unknown or malformed values", () => {
    expect(parseLibraryQuery({ scope: "everyone", type: "strength" })).toEqual({
      ...DEFAULT_LIBRARY_QUERY,
      type: "strength",
    });
    expect(parseLibraryQuery({ scope: "mine", type: "yoga" })).toEqual({ ...DEFAULT_LIBRARY_QUERY, scope: "mine" });
    expect(parseLibraryQuery({ scope: "<script>", type: "%00" })).toEqual(DEFAULT_LIBRARY_QUERY);
    expect(parseLibraryQuery({ scope: "", type: "" })).toEqual(DEFAULT_LIBRARY_QUERY);
  });

  it("uses the first of repeated parameters", () => {
    expect(parseLibraryQuery({ scope: ["mine", "global"] })).toEqual({ ...DEFAULT_LIBRARY_QUERY, scope: "mine" });
  });
});

describe("libraryHref", () => {
  it("omits defaults", () => {
    expect(libraryHref(DEFAULT_LIBRARY_QUERY)).toBe("/library");
    expect(libraryHref({ ...DEFAULT_LIBRARY_QUERY, type: "running" })).toBe("/library?type=running");
  });

  it("switching scope keeps the category (E2-D09)", () => {
    expect(libraryHref({ ...DEFAULT_LIBRARY_QUERY, type: "strength" }, { scope: "global" })).toBe(
      "/library?scope=global&type=strength",
    );
    expect(libraryHref({ ...DEFAULT_LIBRARY_QUERY, scope: "global", type: "strength" }, { scope: "all" })).toBe(
      "/library?type=strength",
    );
  });

  it("round-trips through the parser", () => {
    const query = { scope: "mine", q: "Hip openers", type: "other", equipment: "bench" } as const;
    const url = new URL(libraryHref(query), "http://x.invalid");
    expect(parseLibraryQuery(Object.fromEntries(url.searchParams))).toEqual(query);
  });
});

describe("scopes", () => {
  it("All shows GLOBAL and my own; never anyone else's", () => {
    expect(all.filter((r) => inScope(r, "all")).map((r) => r.id)).toEqual(["g1", "g2", "p1"]);
  });

  it("TrainGrid shows GLOBAL only", () => {
    expect(all.filter((r) => inScope(r, "global")).map((r) => r.id)).toEqual(["g1", "g2"]);
  });

  it("Mine shows my own PERSONAL routines only", () => {
    expect(all.filter((r) => inScope(r, "mine")).map((r) => r.id)).toEqual(["p1"]);
  });

  it("combines scope and category", () => {
    expect(applyLibraryQuery(all, { ...DEFAULT_LIBRARY_QUERY, scope: "global", type: "strength" }).map((r) => r.id)).toEqual([
      "g1",
    ]);
    expect(applyLibraryQuery(all, { ...DEFAULT_LIBRARY_QUERY, type: "strength" }).map((r) => r.id)).toEqual([
      "g1",
      "p1",
    ]);
  });
});

describe("libraryEmptyState", () => {
  const state = (routines: LibraryRoutine[], scope: "all" | "global" | "mine", type = "all") => {
    const query = { ...DEFAULT_LIBRARY_QUERY, scope, type } as Parameters<typeof applyLibraryQuery>[1];
    return libraryEmptyState(routines, query, applyLibraryQuery(routines, query));
  };

  it("nothing to explain when something is visible", () => {
    expect(state(all, "all")).toBe("none");
  });

  it("Mine with no own routines suggests creating one", () => {
    expect(state([lowerA, easyRun], "mine")).toBe("no-own-routines");
  });

  it("a filter that matches nothing is not reported as an empty library", () => {
    expect(state([lowerA, easyRun], "global", "plyometrics")).toBe("no-matches");
    expect(state([mine], "mine", "running")).toBe("no-matches");
  });

  it("an empty view with nothing at all", () => {
    expect(state([], "global")).toBe("no-routines");
    expect(state([], "all")).toBe("no-routines");
  });
});

describe("search and equipment (E2-02)", () => {
  const squat = routine({
    id: "s1",
    name: "Lower A",
    description: "Squat-pattern lower body.",
    itemNames: ["Back Squat", "Romanian Deadlift", "Bulgarian Split Squat"],
    equipment: ["dumbbell", "barbell", "bench"],
    itemCount: 3,
  });
  const run = routine({
    id: "s2",
    name: "Easy Run",
    category: "running",
    description: "Easy aerobic run. Keep it conversational.",
    itemNames: ["Main"],
  });
  const machine = routine({
    id: "s3",
    name: "lower B",
    description: "Hinge-pattern lower body.",
    itemNames: ["Trap Bar Deadlift", "Leg Curl"],
    equipment: ["barbell", "machine"],
  });
  const lib = [run, squat, machine];
  const q = (over: Partial<typeof DEFAULT_LIBRARY_QUERY>) => ({ ...DEFAULT_LIBRARY_QUERY, ...over });
  const ids = (over: Partial<typeof DEFAULT_LIBRARY_QUERY>) => applyLibraryQuery(lib, q(over)).map((r) => r.id);

  it("normalises search text", () => {
    expect(normalizeSearch("  Back \t\n  SQUAT  ")).toBe("Back SQUAT");
    expect(normalizeSearch("a\u0000b")).toBe("a b");
    expect(normalizeSearch(undefined)).toBe("");
    expect(normalizeSearch(42)).toBe("");
    expect(normalizeSearch("x".repeat(250))).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("matches partial words in name, description or item names, ignoring case", () => {
    expect(matchesSearch(squat, "LOWER")).toBe(true);
    expect(matchesSearch(squat, "pattern")).toBe(true);
    expect(matchesSearch(squat, "bulgar")).toBe(true);
    expect(matchesSearch(run, "conversational")).toBe(true);
    expect(matchesSearch(run, "squat")).toBe(false);
  });

  it("requires every word, each anywhere in the routine", () => {
    expect(matchesSearch(squat, "back squat")).toBe(true);
    expect(matchesSearch(squat, "  back   SQUAT ")).toBe(true);
    expect(matchesSearch(squat, "squat curl")).toBe(false);
    expect(matchesSearch(machine, "deadlift curl")).toBe(true);
  });

  it("treats a blank search as no search", () => {
    expect(ids({ q: "   " })).toEqual(["s2", "s1", "s3"]);
  });

  it("equipment matches when any item carries the tag; untagged routines stay without a filter", () => {
    expect(ids({ equipment: "machine" })).toEqual(["s3"]);
    expect(ids({ equipment: "barbell" })).toEqual(["s1", "s3"]);
    expect(ids({})).toContain("s2");
    expect(ids({ equipment: "kettlebell" })).toEqual([]);
  });

  it("combines filters with AND", () => {
    expect(ids({ q: "lower", equipment: "barbell", type: "strength" })).toEqual(["s1", "s3"]);
    expect(ids({ q: "lower", equipment: "machine" })).toEqual(["s3"]);
    expect(ids({ q: "lower", type: "running" })).toEqual([]);
  });

  it("sorts by name, ignoring case, deterministically", () => {
    expect(ids({ type: "strength" })).toEqual(["s1", "s3"]);
    expect(applyLibraryQuery([machine, squat], q({})).map((r) => r.name)).toEqual(["Lower A", "lower B"]);
  });

  it("parses q and equipment, falling back for bad equipment", () => {
    expect(parseLibraryQuery({ q: "  lower  ", equipment: "Barbell" })).toEqual(
      q({ q: "lower", equipment: "barbell" }),
    );
    expect(parseLibraryQuery({ equipment: "trampoline" }).equipment).toBe("all");
    expect(parseLibraryQuery({ q: ["first", "second"] }).q).toBe("first");
  });

  it("builds URLs with every filter and keeps them when switching scope", () => {
    expect(libraryHref(q({ q: "back squat", type: "strength", equipment: "barbell" }), { scope: "global" })).toBe(
      "/library?scope=global&q=back+squat&type=strength&equipment=barbell",
    );
  });

  it("knows when filters are active", () => {
    expect(hasFilters(q({}))).toBe(false);
    expect(hasFilters(q({ scope: "mine" }))).toBe(false);
    expect(hasFilters(q({ q: "x" }))).toBe(true);
    expect(hasFilters(q({ equipment: "bench" }))).toBe(true);
  });
});
