/** Reproducible public-asset budget. Screenshots in docs are not runtime payloads. */
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

async function walk(directory: string): Promise<string[]> {
  const items = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      items.map((item) =>
        item.isDirectory()
          ? walk(path.join(directory, item.name))
          : [path.join(directory, item.name)],
      ),
    )
  ).flat();
}
async function main() {
  const files = await Promise.all(
    (await walk("public")).sort().map(async (file) => {
      const bytes = await readFile(file);
      return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
    }),
  );
  const total = files.reduce((sum, item) => sum + item.bytes, 0);
  const violations = files.filter(
    (item) =>
      item.bytes > (item.file.endsWith(".svg") ? 20 * 1024 : 512 * 1024),
  );
  if (total > 1024 * 1024 || violations.length)
    throw new Error(
      `UI asset budget exceeded: ${JSON.stringify({ total, violations })}`,
    );
  await mkdir(".next/ui-audit", { recursive: true });
  await writeFile(
    ".next/ui-audit/public-assets.json",
    JSON.stringify(
      { budgetBytes: 1024 * 1024, totalBytes: total, files },
      null,
      2,
    ),
  );
  console.log(
    `${files.length} local public assets: ${total} bytes (budget: 1 MiB).`,
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
