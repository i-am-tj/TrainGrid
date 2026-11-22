import type { Metadata } from "next";

/**
 * Metadata for every social page: a generic title (never a member's name, so
 * nothing personal reaches link previews, history sync or tab titles shared
 * in screenshots) and no indexing, archiving or snippets. The pages are also
 * members-only and rendered per request; next.config.ts adds the same rule as
 * an X-Robots-Tag header.
 */
export function socialMetadata(title: string): Metadata {
  return {
    title: `${title} · TrainGrid`,
    robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
    referrer: "same-origin",
  };
}
