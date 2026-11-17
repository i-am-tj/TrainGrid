import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  configuredSiteOrigin,
  parseSiteOrigin,
  siteMetadataBase,
  trustedLoginUrl,
} from "./site";

describe("parseSiteOrigin", () => {
  it("accepts HTTPS origins and local HTTP", () => {
    expect(parseSiteOrigin("https://traingrid.example.com")).toBe("https://traingrid.example.com");
    expect(parseSiteOrigin(" https://traingrid.example.com/ ")).toBe("https://traingrid.example.com");
    expect(parseSiteOrigin("http://127.0.0.1:3010")).toBe("http://127.0.0.1:3010");
    expect(parseSiteOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rejects anything that is not a bare trusted origin", () => {
    for (const value of [
      undefined,
      "",
      "traingrid.example.com",
      "http://traingrid.example.com",
      "https://user:pass@traingrid.example.com",
      "https://traingrid.example.com/path",
      "https://traingrid.example.com/?x=1",
      "javascript:alert(1)",
      "ftp://traingrid.example.com",
    ]) {
      expect(parseSiteOrigin(value), String(value)).toBeNull();
    }
  });
});

describe("configuredSiteOrigin", () => {
  it("prefers TRAINGRID_SITE_URL, then Vercel's production domain", () => {
    expect(
      configuredSiteOrigin({
        TRAINGRID_SITE_URL: "https://app.example.com",
        VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app",
      }),
    ).toBe("https://app.example.com");
    expect(configuredSiteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "train-grid.vercel.app" })).toBe(
      "https://train-grid.vercel.app",
    );
    expect(configuredSiteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "evil.example/path" })).toBeNull();
    expect(configuredSiteOrigin({})).toBeNull();
  });

  it("builds the trusted login URL and metadata base from it", () => {
    const env = { TRAINGRID_SITE_URL: "https://app.example.com" };
    expect(trustedLoginUrl(env)).toBe("https://app.example.com/login");
    expect(siteMetadataBase(env)?.toString()).toBe("https://app.example.com/");
    expect(trustedLoginUrl({})).toBeNull();
    expect(siteMetadataBase({})).toBeNull();
  });

  it("sets a canonical URL only when the origin is explicit", () => {
    expect(canonicalUrl("/", { TRAINGRID_SITE_URL: "https://app.example.com" })).toBe(
      "https://app.example.com/",
    );
    expect(canonicalUrl("/", { VERCEL_PROJECT_PRODUCTION_URL: "train-grid.vercel.app" })).toBeNull();
  });
});
