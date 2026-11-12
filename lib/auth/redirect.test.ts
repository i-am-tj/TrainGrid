import { describe, expect, it } from "vitest";
import { buildCallbackUrl, originFromHeaders, safeNextPath } from "./redirect";

function headers(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

describe("safeNextPath", () => {
  it("keeps plain same-site paths, with their query string", () => {
    expect(safeNextPath("/library")).toBe("/library");
    expect(safeNextPath("/week/2026-W46?day=4")).toBe("/week/2026-W46?day=4");
  });

  it("falls back to / for missing or non-string input", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(42)).toBe("/");
  });

  it("rejects anything that could leave the site", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "evil.example",
      "javascript:alert(1)",
      "/ok\nSet-Cookie: x=1",
      "/path\\with\\backslash",
    ]) {
      expect(safeNextPath(value), value).toBe("/");
    }
  });

  it("does not send the user back into the sign-in flow", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?error=x")).toBe("/");
    expect(safeNextPath("/auth/callback?code=abc")).toBe("/");
  });

  it("drops fragments and rejects overlong values", () => {
    expect(safeNextPath("/library#top")).toBe("/library");
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/");
  });
});

describe("originFromHeaders", () => {
  it("uses forwarded headers behind a proxy", () => {
    expect(
      originFromHeaders(
        headers({
          "x-forwarded-host": "train-grid.vercel.app",
          "x-forwarded-proto": "https",
          host: "internal:3000",
        }),
      ),
    ).toBe("https://train-grid.vercel.app");
  });

  it("defaults to http for local hosts and https otherwise", () => {
    expect(originFromHeaders(headers({ host: "127.0.0.1:3000" }))).toBe("http://127.0.0.1:3000");
    expect(originFromHeaders(headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(originFromHeaders(headers({ host: "train-grid.vercel.app" }))).toBe(
      "https://train-grid.vercel.app",
    );
  });

  it("takes the first value of a comma-separated forwarded header", () => {
    expect(
      originFromHeaders(
        headers({ "x-forwarded-host": "a.example, b.example", "x-forwarded-proto": "https, http" }),
      ),
    ).toBe("https://a.example");
  });

  it("throws on a missing or malformed host", () => {
    expect(() => originFromHeaders(headers({}))).toThrow();
    expect(() => originFromHeaders(headers({ host: "evil.example/path" }))).toThrow();
    expect(() => originFromHeaders(headers({ host: "user@evil.example" }))).toThrow();
  });
});

describe("buildCallbackUrl", () => {
  it("points at /auth/callback on the given origin", () => {
    expect(buildCallbackUrl("https://train-grid.vercel.app", "/")).toBe(
      "https://train-grid.vercel.app/auth/callback",
    );
  });

  it("carries a safe next path and drops an unsafe one", () => {
    expect(buildCallbackUrl("http://127.0.0.1:3000", "/library")).toBe(
      "http://127.0.0.1:3000/auth/callback?next=%2Flibrary",
    );
    expect(buildCallbackUrl("http://127.0.0.1:3000", "//evil.example")).toBe(
      "http://127.0.0.1:3000/auth/callback",
    );
  });
});
