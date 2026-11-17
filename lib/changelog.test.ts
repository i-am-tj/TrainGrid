import { describe, expect, it } from "vitest";
import { displayVersion, inlineTokens, isRecentRelease, parseChangelog } from "./changelog";

const SAMPLE = `# Changelog

Intro for the file.

## [Unreleased]

- Not shown yet.

## [1.0.0] — 2026-11-18

The milestone.
A wrapped second line.

- **Getting started**: three steps,
  wrapped onto a second line.
- Feedback from the header.

### For maintainers

- CI on every PR.

## [0.2.0-beta] — 2026-11-13

### Planner

- A week grid.

[1.0.0]: https://github.com/i-am-tj/TrainGrid/releases/tag/v1.0.0
`;

describe("parseChangelog", () => {
  const releases = parseChangelog(SAMPLE);

  it("reads releases newest first, skipping Unreleased", () => {
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ["1.0.0", "2026-11-18"],
      ["0.2.0-beta", "2026-11-13"],
    ]);
  });

  it("joins wrapped paragraphs and bullets, and leaves out maintainer notes", () => {
    expect(releases[0]!.blocks).toEqual([
      { type: "paragraph", text: "The milestone. A wrapped second line." },
      { type: "list", items: ["**Getting started**: three steps, wrapped onto a second line.", "Feedback from the header."] },
    ]);
  });

  it("keeps group headings and ignores link definitions", () => {
    expect(releases[1]!.blocks).toEqual([
      { type: "heading", text: "Planner" },
      { type: "list", items: ["A week grid."] },
    ]);
  });
});

describe("inlineTokens", () => {
  it("keeps bold, code and safe links as tokens", () => {
    expect(inlineTokens("**Bold** and `code` and [docs](https://example.com/a) end")).toEqual([
      { type: "strong", value: "Bold" },
      { type: "text", value: " and " },
      { type: "code", value: "code" },
      { type: "text", value: " and " },
      { type: "link", value: "docs", href: "https://example.com/a" },
      { type: "text", value: " end" },
    ]);
  });

  it("turns unsafe links into plain text", () => {
    expect(inlineTokens("[x](javascript:alert(1))")).not.toContainEqual(expect.objectContaining({ type: "link" }));
    expect(inlineTokens("[x](//evil.example)")).toEqual([{ type: "text", value: "x" }]);
  });
});

describe("helpers", () => {
  it("shortens whole versions", () => {
    expect(displayVersion("1.0.0")).toBe("1.0");
    expect(displayVersion("1.2.3")).toBe("1.2.3");
    expect(displayVersion("0.2.1-beta")).toBe("0.2.1-beta");
  });

  it("announces a release for three weeks", () => {
    const release = { version: "1.0.0", date: "2026-11-18", blocks: [] };
    expect(isRecentRelease(release, "2026-11-18")).toBe(true);
    expect(isRecentRelease(release, "2026-12-09")).toBe(true);
    expect(isRecentRelease(release, "2026-12-10")).toBe(false);
    expect(isRecentRelease(release, "2026-11-17")).toBe(false);
    expect(isRecentRelease(undefined, "2026-11-18")).toBe(false);
  });
});
