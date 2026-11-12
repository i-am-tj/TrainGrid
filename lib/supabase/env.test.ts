import { describe, expect, it } from "vitest";
import { looksLikeSecretKey, readSupabaseEnv } from "./env";

function legacyJwt(role: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({ role })}.signature`;
}

describe("readSupabaseEnv", () => {
  it("returns null when either value is missing or blank", () => {
    expect(readSupabaseEnv(undefined, undefined)).toBeNull();
    expect(readSupabaseEnv("https://example.supabase.co", undefined)).toBeNull();
    expect(readSupabaseEnv(undefined, "sb_publishable_abc")).toBeNull();
    expect(readSupabaseEnv("  ", "sb_publishable_abc")).toBeNull();
  });

  it("returns null for a value that is not an http(s) URL", () => {
    expect(readSupabaseEnv("not a url", "sb_publishable_abc")).toBeNull();
    expect(readSupabaseEnv("ftp://example.test", "sb_publishable_abc")).toBeNull();
  });

  it("trims values and strips trailing slashes from the URL", () => {
    expect(
      readSupabaseEnv(" https://example.supabase.co/ ", " sb_publishable_abc "),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_abc",
    });
  });

  it("accepts a local stack URL", () => {
    expect(readSupabaseEnv("http://127.0.0.1:54321", "sb_publishable_abc")).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_abc",
    });
  });

  it("throws when a secret key is placed in the public slot", () => {
    expect(() =>
      readSupabaseEnv("https://example.supabase.co", "sb_secret_abc"),
    ).toThrow(/secret key/);
    expect(() =>
      readSupabaseEnv("https://example.supabase.co", legacyJwt("service_role")),
    ).toThrow(/secret key/);
  });
});

describe("looksLikeSecretKey", () => {
  it("flags secret and legacy service-role keys only", () => {
    expect(looksLikeSecretKey("sb_secret_abc")).toBe(true);
    expect(looksLikeSecretKey(legacyJwt("service_role"))).toBe(true);
    expect(looksLikeSecretKey("sb_publishable_abc")).toBe(false);
    expect(looksLikeSecretKey(legacyJwt("anon"))).toBe(false);
    expect(looksLikeSecretKey("a.b.c")).toBe(false);
  });
});
