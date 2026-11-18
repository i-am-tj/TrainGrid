import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parseChangelog, type Release } from "@/lib/changelog";

/**
 * The releases in CHANGELOG.md, read once per request. The file ships with
 * the deployment (next.config.ts, outputFileTracingIncludes). A missing or
 * unreadable file means "no releases", never an error page.
 */
export const loadReleases = cache(async (): Promise<Release[]> => {
  try {
    return parseChangelog(await readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8"));
  } catch {
    return [];
  }
});
