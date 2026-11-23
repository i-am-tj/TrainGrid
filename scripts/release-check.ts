/**
 * Release check: does a Supabase project have every table, column and
 * function this checkout needs? (docs/RELEASING.md, PRODUCT_AUDIT F1)
 *
 *   npm run release:check                       local stack (.env.local)
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<secret> \
 *     npm run release:check                     another project, e.g. production
 *   npm run release:check -- --write            regenerate lib/release/schema-manifest.json
 *                                               from the local stack (after a migration)
 *   npm run release:check -- --exact            CI: the local stack and the manifest must
 *                                               match exactly, so the manifest is never stale
 *
 * Read-only: it fetches the Data API's OpenAPI document and nothing else.
 * Exits 1 when the project is behind, so a release can be gated on it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describeGap, fetchSchemaShape, isBehind, sameShape, schemaGap, type SchemaShape } from "../lib/release/schema";

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "lib/release/schema-manifest.json");

// The local stack's settings, unless a project was named on the command line.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(path.join(root, ".env.local"))) {
  process.loadEnvFile(path.join(root, ".env.local"));
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const args = new Set(process.argv.slice(2));
const isLocal = (value: string) => /^http:\/\/(127\.0\.0\.1|localhost):/.test(value);

async function main() {
  if (!url || !secretKey) {
    fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (the project's secret key).");
  }
  const target = isLocal(url) ? "the local stack" : new URL(url).host;
  const actual = await fetchSchemaShape(url, secretKey, { timeoutMs: 15_000 }).catch((error: Error) =>
    fail(`Could not read the schema of ${target}: ${error.message}`),
  );

  if (args.has("--write")) {
    if (!isLocal(url)) fail("--write reads the local stack only. Apply the migrations locally first.");
    writeFileSync(manifestPath, `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`Wrote ${path.relative(root, manifestPath)}: ${Object.keys(actual.tables).length} tables, ${actual.functions.length} functions.`);
    return;
  }

  const expected = JSON.parse(readFileSync(manifestPath, "utf8")) as SchemaShape;
  if (args.has("--exact")) {
    if (sameShape(expected, actual)) {
      console.log(`✓ ${path.relative(root, manifestPath)} matches ${target}.`);
      return;
    }
    const lines = [
      ...describeGap(schemaGap(expected, actual)).map((line) => `stack ${line}`),
      ...describeGap(schemaGap(actual, expected)).map((line) => `manifest ${line}`),
    ];
    fail(
      `${path.relative(root, manifestPath)} does not match ${target}:\n  ${lines.join("\n  ")}\n` +
        "Apply every migration locally, then run: npm run release:check -- --write",
    );
  }

  const gap = schemaGap(expected, actual);
  if (isBehind(gap)) {
    fail(
      `${target} is behind this checkout:\n  ${describeGap(gap).join("\n  ")}\n` +
        "Apply the missing migrations in supabase/migrations/ before deploying (supabase/README.md).",
    );
  }
  console.log(`✓ ${target} has every table, column and function this checkout needs.`);
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

void main();
