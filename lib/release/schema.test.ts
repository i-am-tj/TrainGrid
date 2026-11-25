import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  describeGap,
  fetchSchemaShape,
  isBehind,
  migrationsFromResponse,
  sameShape,
  schemaGap,
  shapeFromOpenApi,
} from "./schema";
import manifest from "./schema-manifest.json";

const openApi = {
  swagger: "2.0",
  paths: { "/": {}, "/scheduled_sessions": {}, "/rpc/is_member": {}, "/rpc/social_posts": {} },
  definitions: {
    scheduled_sessions: { properties: { origin: {}, id: {}, date: {} } },
    profiles: { properties: { id: {} } },
  },
};

describe("shapeFromOpenApi", () => {
  it("lists tables with sorted columns, and functions", () => {
    expect(shapeFromOpenApi(openApi)).toEqual({
      tables: { profiles: ["id"], scheduled_sessions: ["date", "id", "origin"] },
      functions: ["is_member", "social_posts"],
    });
  });

  it("rejects anything else", () => {
    expect(() => shapeFromOpenApi({ message: "Unauthorized" })).toThrow("Not an OpenAPI document.");
    expect(() => shapeFromOpenApi(null)).toThrow();
  });
});

describe("schemaGap", () => {
  const expected = {
    tables: { scheduled_sessions: ["date", "id", "origin"], post_likes: ["post_id"] },
    functions: ["is_member", "social_posts"],
  };

  it("finds the migration that was never applied (the audit's missing origin column)", () => {
    const actual = {
      tables: { scheduled_sessions: ["date", "id"], profiles: ["id"] },
      functions: ["is_member"],
    };
    const gap = schemaGap(expected, actual);
    expect(gap).toEqual({
      missingTables: ["post_likes"],
      missingColumns: ["scheduled_sessions.origin"],
      missingFunctions: ["social_posts"],
      missingMigrations: [],
    });
    expect(isBehind(gap)).toBe(true);
    expect(describeGap(gap)).toEqual([
      "missing table: post_likes",
      "missing column: scheduled_sessions.origin",
      "missing function: social_posts()",
    ]);
  });

  it("lets a database that is ahead of the build pass", () => {
    const ahead = {
      tables: { ...expected.tables, scheduled_sessions: [...expected.tables.scheduled_sessions, "new_column"], extra: ["id"] },
      functions: [...expected.functions, "new_function"],
    };
    expect(isBehind(schemaGap(expected, ahead))).toBe(false);
    expect(sameShape(expected, ahead)).toBe(false);
    expect(sameShape(expected, structuredClone(expected))).toBe(true);
  });

  it("finds migrations that change no names (the two from #86 that production lacked)", () => {
    const build = { ...expected, migrations: ["20261125000000", "20261125010000", "20261125020000"] };
    const production = { ...structuredClone(expected), migrations: ["20261125000000"] };
    const gap = schemaGap(build, production);
    expect(gap.missingMigrations).toEqual(["20261125010000", "20261125020000"]);
    expect(isBehind(gap)).toBe(true);
    expect(describeGap(gap)).toEqual(["missing migration: 20261125010000", "missing migration: 20261125020000"]);
    // A project that has applied more than the build knows is ahead, which is fine.
    expect(isBehind(schemaGap(production, build))).toBe(false);
  });

  it("leaves migrations to the function check when a project cannot report them", () => {
    const build = { tables: {}, functions: ["release_applied_migrations"], migrations: ["20261127000000"] };
    const old = { tables: {}, functions: [] };
    expect(schemaGap(build, old)).toMatchObject({ missingFunctions: ["release_applied_migrations"], missingMigrations: [] });
    // CI's exact match needs both sides to list migrations.
    expect(sameShape({ tables: {}, functions: [] }, { tables: {}, functions: [], migrations: [] })).toBe(false);
  });
});

describe("the checked-in manifest", () => {
  it("covers the columns the planner reads, including the quick-workout origin", () => {
    expect(manifest.tables.scheduled_sessions).toContain("origin");
    expect(manifest.tables).toHaveProperty("workout_logs");
    expect(manifest.functions).toContain("save_personal_routine");
  });

  it("lists every migration in supabase/migrations, so a project missing one is behind", () => {
    const files = readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.slice(0, 14))
      .sort();
    expect(manifest.migrations).toEqual(files);
    expect(manifest.functions).toContain("release_applied_migrations");
  });
});

describe("fetchSchemaShape", () => {
  it("reads the OpenAPI document with the secret key", async () => {
    let seen: Request | null = null;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = new Request(input, init);
      return Response.json(openApi);
    }) as typeof fetch;
    const shape = await fetchSchemaShape("https://example.supabase.co/", "sb_secret_x", { fetchImpl });
    expect(shape.functions).toEqual(["is_member", "social_posts"]);
    expect(seen!.url).toBe("https://example.supabase.co/rest/v1/");
    expect(seen!.headers.get("apikey")).toBe("sb_secret_x");
  });

  it("fails on an error status", async () => {
    const fetchImpl = (async () => new Response("no", { status: 401 })) as typeof fetch;
    await expect(fetchSchemaShape("https://example.supabase.co", "k", { fetchImpl })).rejects.toThrow("401");
  });

  const withHistory = { ...openApi, paths: { ...openApi.paths, "/rpc/release_applied_migrations": {} } };

  it("asks the project for its applied migrations, with the secret key, when it can say", async () => {
    const seen: Request[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      seen.push(request);
      return request.url.endsWith("/rpc/release_applied_migrations")
        ? Response.json(["20261126000000", "20261112000000"])
        : Response.json(withHistory);
    }) as typeof fetch;
    const shape = await fetchSchemaShape("https://example.supabase.co", "sb_secret_x", { fetchImpl });
    expect(shape.migrations).toEqual(["20261112000000", "20261126000000"]);
    expect(seen[1]!.method).toBe("POST");
    expect(seen[1]!.headers.get("authorization")).toBe("Bearer sb_secret_x");
  });

  it("does not pass silently when the history cannot be read", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) =>
      String(input).includes("/rpc/") ? new Response("no", { status: 500 }) : Response.json(withHistory)) as typeof fetch;
    await expect(fetchSchemaShape("https://example.supabase.co", "k", { fetchImpl })).rejects.toThrow("500");
  });

  it("accepts only migration versions", () => {
    expect(() => migrationsFromResponse({ message: "no" })).toThrow();
    expect(() => migrationsFromResponse(["20261126000000", "drop table"])).toThrow();
    expect(migrationsFromResponse([])).toEqual([]);
  });
});
