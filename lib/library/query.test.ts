import { describe, expect, it } from "vitest";
import type { RoutineSummary } from "@/lib/data/model";
import {
  applyLibraryQuery,
  DEFAULT_LIBRARY_QUERY,
  inScope,
  libraryEmptyState,
  libraryHref,
  parseLibraryQuery,
} from "./query";

const routine = (over: Partial<RoutineSummary>): RoutineSummary => ({
  id: "id",
  scope: "GLOBAL",
  isOwn: false,
  slug: null,
  name: "Routine",
  category: "strength",
  description: "",
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
      scope: "global",
      type: "strength",
    });
    expect(parseLibraryQuery({ scope: "mine" })).toEqual({ scope: "mine", type: "all" });
  });

  it("keeps existing ?type= links working", () => {
    expect(parseLibraryQuery({ type: "plyometrics" })).toEqual({ scope: "all", type: "plyometrics" });
  });

  it("tolerates case and surrounding spaces", () => {
    expect(parseLibraryQuery({ scope: " Global ", type: "RUNNING" })).toEqual({
      scope: "global",
      type: "running",
    });
  });

  it("falls back per parameter for unknown or malformed values", () => {
    expect(parseLibraryQuery({ scope: "everyone", type: "strength" })).toEqual({
      scope: "all",
      type: "strength",
    });
    expect(parseLibraryQuery({ scope: "mine", type: "yoga" })).toEqual({ scope: "mine", type: "all" });
    expect(parseLibraryQuery({ scope: "<script>", type: "%00" })).toEqual(DEFAULT_LIBRARY_QUERY);
    expect(parseLibraryQuery({ scope: "", type: "" })).toEqual(DEFAULT_LIBRARY_QUERY);
  });

  it("uses the first of repeated parameters", () => {
    expect(parseLibraryQuery({ scope: ["mine", "global"] })).toEqual({ scope: "mine", type: "all" });
  });
});

describe("libraryHref", () => {
  it("omits defaults", () => {
    expect(libraryHref(DEFAULT_LIBRARY_QUERY)).toBe("/library");
    expect(libraryHref({ scope: "all", type: "running" })).toBe("/library?type=running");
  });

  it("switching scope keeps the category (E2-D09)", () => {
    expect(libraryHref({ scope: "all", type: "strength" }, { scope: "global" })).toBe(
      "/library?scope=global&type=strength",
    );
    expect(libraryHref({ scope: "global", type: "strength" }, { scope: "all" })).toBe(
      "/library?type=strength",
    );
  });

  it("round-trips through the parser", () => {
    const query = { scope: "mine", type: "other" } as const;
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
    expect(applyLibraryQuery(all, { scope: "global", type: "strength" }).map((r) => r.id)).toEqual([
      "g1",
    ]);
    expect(applyLibraryQuery(all, { scope: "all", type: "strength" }).map((r) => r.id)).toEqual([
      "g1",
      "p1",
    ]);
  });
});

describe("libraryEmptyState", () => {
  const state = (routines: RoutineSummary[], scope: "all" | "global" | "mine", type = "all") => {
    const query = { scope, type } as Parameters<typeof applyLibraryQuery>[1];
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
