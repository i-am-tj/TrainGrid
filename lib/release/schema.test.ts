import { describe, expect, it } from "vitest";
import { describeGap, fetchSchemaShape, isBehind, sameShape, schemaGap, shapeFromOpenApi } from "./schema";
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
});

describe("the checked-in manifest", () => {
  it("covers the columns the planner reads, including the quick-workout origin", () => {
    expect(manifest.tables.scheduled_sessions).toContain("origin");
    expect(manifest.tables).toHaveProperty("workout_logs");
    expect(manifest.functions).toContain("save_personal_routine");
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
});
