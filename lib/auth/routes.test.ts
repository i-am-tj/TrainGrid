import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";
import { isApiPath, isPublicPath, loginPathFor } from "./routes";

describe("isPublicPath", () => {
  it("allows only the sign-in surfaces and the health check", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("treats everything else as private", () => {
    for (const path of [
      "/",
      "/week/2026-W46",
      "/library",
      "/library/lower-a",
      "/session/abc",
      "/admin",
      "/admin/invitations",
      "/api/export",
      "/api",
      "/auth",
      "/auth/callback/extra",
      "/login/anything",
      "/loginx",
      "/LOGIN",
    ]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });
});

describe("isApiPath", () => {
  it("recognises API routes", () => {
    expect(isApiPath("/api/export")).toBe(true);
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
    expect(isApiPath("/library")).toBe(false);
  });
});

describe("loginPathFor", () => {
  it("goes to plain /login from the home page", () => {
    expect(loginPathFor("/", "")).toBe("/login");
  });

  it("remembers the requested page, in a form safeNextPath accepts", () => {
    const login = loginPathFor("/week/2026-W46", "?day=4");
    expect(login).toBe("/login?next=%2Fweek%2F2026-W46%3Fday%3D4");
    const next = new URL(login, "http://x.invalid").searchParams.get("next");
    expect(safeNextPath(next)).toBe("/week/2026-W46?day=4");
  });
});
