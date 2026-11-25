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
 * Names alone miss a migration that only changes a function body or adds a
 * trigger (on 25 November 2026 production reported "ok" without two of
 * them). So the manifest also lists every migration version in the build,
 * and the project reports the versions it has applied through
 * `release_applied_migrations()`, callable with the secret key only.
 *
 * A database that is AHEAD of the build (a migration applied before the
 * deploy, as docs/RELEASING.md asks) passes: only missing things count.
 */

export type SchemaShape = {
  /** Table (or view) name → its column names, sorted. */
  tables: Record<string, string[]>;
  /** RPC function names, sorted. */
  functions: string[];
  /**
   * Migration versions, sorted: in the manifest, those in the build; from a
   * project, those it has applied. Absent when a project cannot report them
   * (release_applied_migrations() is missing, which `functions` then shows).
   */
  migrations?: string[];
};

export type SchemaGap = {
  missingTables: string[];
  /** `table.column`, for tables that exist. */
  missingColumns: string[];
  missingFunctions: string[];
  missingMigrations: string[];
};

/** The function a project reports its applied migrations through. */
export const MIGRATIONS_FUNCTION = "release_applied_migrations";

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
  const applied = new Set(actual.migrations ?? []);
  const missingMigrations =
    expected.migrations && actual.migrations ? expected.migrations.filter((version) => !applied.has(version)) : [];
  return { missingTables, missingColumns, missingFunctions, missingMigrations };
}

export function isBehind(gap: SchemaGap): boolean {
  return (
    gap.missingTables.length + gap.missingColumns.length + gap.missingFunctions.length + gap.missingMigrations.length > 0
  );
}

/** Both directions, for CI: the manifest must match the freshly migrated local stack exactly. */
export function sameShape(a: SchemaShape, b: SchemaShape): boolean {
  if ((a.migrations === undefined) !== (b.migrations === undefined)) return false;
  return !isBehind(schemaGap(a, b)) && !isBehind(schemaGap(b, a));
}

/** One line per problem, for the release check's output. */
export function describeGap(gap: SchemaGap): string[] {
  return [
    ...gap.missingTables.map((table) => `missing table: ${table}`),
    ...gap.missingColumns.map((column) => `missing column: ${column}`),
    ...gap.missingFunctions.map((name) => `missing function: ${name}()`),
    ...gap.missingMigrations.map((version) => `missing migration: ${version}`),
  ];
}

/** Reads the versions out of release_applied_migrations()'s answer. */
export function migrationsFromResponse(body: unknown): string[] {
  if (!Array.isArray(body) || !body.every((version) => typeof version === "string" && /^\d{14}$/.test(version))) {
    throw new Error("Not a list of migration versions.");
  }
  return sorted(body as string[]);
}

/**
 * Fetches the project's current shape, and its applied migrations when it can
 * report them. Needs the secret key: neither is public.
 */
export async function fetchSchemaShape(
  url: string,
  secretKey: string,
  { fetchImpl = fetch, timeoutMs = 5000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SchemaShape> {
  const base = `${url.replace(/\/$/, "")}/rest/v1`;
  const auth = { apikey: secretKey, Authorization: `Bearer ${secretKey}` };
  const response = await fetchImpl(`${base}/`, {
    headers: { ...auth, Accept: "application/openapi+json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`The Data API answered ${response.status}.`);
  const shape = shapeFromOpenApi(await response.json());
  // Not there yet (a project behind this build): `functions` already says so.
  if (!shape.functions.includes(MIGRATIONS_FUNCTION)) return shape;

  // There: a failed call is an unknown answer, never a silent pass.
  const history = await fetchImpl(`${base}/rpc/${MIGRATIONS_FUNCTION}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!history.ok) throw new Error(`The migration history answered ${history.status}.`);
  return { ...shape, migrations: migrationsFromResponse(await history.json()) };
}
