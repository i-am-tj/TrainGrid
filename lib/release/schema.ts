/**
 * Does a Supabase project's database have everything this build of TrainGrid
 * reads and writes?
 *
 * Auth can be healthy while the planner fails because a migration was never
 * applied (PRODUCT_AUDIT F1: `scheduled_sessions.origin` was missing). The
 * expected shape is `schema-manifest.json`, generated from the local stack
 * after every migration (`npm run release:check -- --write`) and kept honest
 * in CI (`--exact`). The actual shape comes from PostgREST's OpenAPI document,
 * which lists every table, column and function the Data API can reach; it is
 * readable only with the secret key.
 *
 * A database that is AHEAD of the build (a migration applied before the
 * deploy, as docs/RELEASING.md asks) passes: only missing things count.
 */

export type SchemaShape = {
  /** Table (or view) name → its column names, sorted. */
  tables: Record<string, string[]>;
  /** RPC function names, sorted. */
  functions: string[];
};

export type SchemaGap = {
  missingTables: string[];
  /** `table.column`, for tables that exist. */
  missingColumns: string[];
  missingFunctions: string[];
};

export type SchemaStatus = "ok" | "behind" | "unknown";

const sorted = (values: Iterable<string>) => [...values].sort((a, b) => a.localeCompare(b));

/** Reads the tables, columns and functions out of PostgREST's OpenAPI (Swagger 2) document. */
export function shapeFromOpenApi(doc: unknown): SchemaShape {
  if (!doc || typeof doc !== "object") throw new Error("Not an OpenAPI document.");
  const { paths, definitions } = doc as { paths?: unknown; definitions?: unknown };
  if (!paths || typeof paths !== "object" || !definitions || typeof definitions !== "object") {
    throw new Error("Not an OpenAPI document.");
  }

  const tables: Record<string, string[]> = {};
  for (const name of sorted(Object.keys(definitions))) {
    const properties = (definitions as Record<string, { properties?: Record<string, unknown> }>)[name]?.properties;
    tables[name] = sorted(Object.keys(properties ?? {}));
  }
  const functions = sorted(
    Object.keys(paths)
      .filter((path) => path.startsWith("/rpc/"))
      .map((path) => path.slice("/rpc/".length)),
  );
  return { tables, functions };
}

/** What `expected` has that `actual` lacks. Anything extra in `actual` is fine. */
export function schemaGap(expected: SchemaShape, actual: SchemaShape): SchemaGap {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const [table, columns] of Object.entries(expected.tables)) {
    const present = actual.tables[table];
    if (!present) {
      missingTables.push(table);
      continue;
    }
    const have = new Set(present);
    for (const column of columns) if (!have.has(column)) missingColumns.push(`${table}.${column}`);
  }
  const haveFunctions = new Set(actual.functions);
  const missingFunctions = expected.functions.filter((name) => !haveFunctions.has(name));
  return { missingTables, missingColumns, missingFunctions };
}

export function isBehind(gap: SchemaGap): boolean {
  return gap.missingTables.length + gap.missingColumns.length + gap.missingFunctions.length > 0;
}

/** Both directions, for CI: the manifest must match the freshly migrated local stack exactly. */
export function sameShape(a: SchemaShape, b: SchemaShape): boolean {
  return !isBehind(schemaGap(a, b)) && !isBehind(schemaGap(b, a));
}

/** One line per problem, for the release check's output. */
export function describeGap(gap: SchemaGap): string[] {
  return [
    ...gap.missingTables.map((table) => `missing table: ${table}`),
    ...gap.missingColumns.map((column) => `missing column: ${column}`),
    ...gap.missingFunctions.map((name) => `missing function: ${name}()`),
  ];
}

/** Fetches the project's current shape. Needs the secret key: the OpenAPI document is not public. */
export async function fetchSchemaShape(
  url: string,
  secretKey: string,
  { fetchImpl = fetch, timeoutMs = 5000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SchemaShape> {
  const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, Accept: "application/openapi+json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`The Data API answered ${response.status}.`);
  return shapeFromOpenApi(await response.json());
}
