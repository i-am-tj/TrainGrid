/**
 * Reads CHANGELOG.md into releases for the What's new page. Pure: text in,
 * data out. Understands the subset the changelog uses: `## [version] — date`
 * headings, paragraphs, `### group` headings, and `- ` bullets whose lines
 * wrap with indentation. Inline text keeps **bold**, `code` and [links](url)
 * as tokens; nothing is ever rendered as HTML.
 *
 * Member-facing only: [Unreleased] and any "For maintainers" group are left out.
 */

export type InlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

export type ReleaseBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] };

export type Release = {
  version: string;
  /** ISO date (YYYY-MM-DD), or null when the heading has none. */
  date: string | null;
  blocks: ReleaseBlock[];
};

const RELEASE_HEADING = /^## \[([^\]]+)\](?:\s*[—–-]\s*(\d{4}-\d{2}-\d{2}))?/;
const HIDDEN_GROUPS = /^for maintainers$/i;

export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let current: Release | null = null;
  let hidden = false;
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flushParagraph = () => {
    if (current && !hidden && paragraph.length) current.blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (current && !hidden && list?.length) current.blocks.push({ type: "list", items: list });
    list = null;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      current = heading[1]!.toLowerCase() === "unreleased" ? null : { version: heading[1]!, date: heading[2] ?? null, blocks: [] };
      if (current) releases.push(current);
      hidden = false;
      continue;
    }
    if (!current) continue;
    // Link reference definitions at the bottom: "[0.2.0-beta]: https://…".
    if (/^\[[^\]]+\]:\s*\S+/.test(line)) continue;

    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      const text = line.slice(4).trim();
      hidden = HIDDEN_GROUPS.test(text);
      if (!hidden) current.blocks.push({ type: "heading", text });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list ??= [];
      list.push(line.slice(2).trim());
      continue;
    }
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    // A wrapped line: continues the open bullet, or the paragraph.
    if (list && /^\s+/.test(raw)) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return releases;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Only web links and local paths become links; anything else stays text. */
function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function inlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) tokens.push({ type: "strong", value: part.slice(2, -2) });
    else if (part.startsWith("`") && part.endsWith("`")) tokens.push({ type: "code", value: part.slice(1, -1) });
    else if (part.startsWith("[")) {
      const match = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)!;
      const href = safeHref(match[2]!);
      tokens.push(href ? { type: "link", value: match[1]!, href } : { type: "text", value: match[1]! });
    } else tokens.push({ type: "text", value: part });
  }
  return tokens;
}

/** "1.0.0" → "1.0"; "0.2.1-beta" stays as it is. */
export function displayVersion(version: string): string {
  return /^\d+\.\d+\.0$/.test(version) ? version.replace(/\.0$/, "") : version;
}

/** Whether a release is recent enough to announce on /home. */
export function isRecentRelease(release: Release | undefined, todayIso: string, days = 21): boolean {
  if (!release?.date) return false;
  const age = (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${release.date}T00:00:00Z`)) / 86_400_000;
  return age >= 0 && age <= days;
}
