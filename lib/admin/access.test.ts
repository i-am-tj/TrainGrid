import { describe, expect, it } from "vitest";
import { isAdminViewer, parseAdminUserIds } from "./access";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("parseAdminUserIds", () => {
  it("returns an empty set when unset or blank", () => {
    expect(parseAdminUserIds(undefined).size).toBe(0);
    expect(parseAdminUserIds("   ").size).toBe(0);
  });

  it("splits on commas and whitespace and lower-cases", () => {
    const ids = parseAdminUserIds(` ${A.toUpperCase()},\n${B} `);
    expect([...ids]).toEqual([A, B]);
  });

  it("ignores entries that are not UUIDs", () => {
    const ids = parseAdminUserIds(`someone@example.test, *, true, ${A}`);
    expect([...ids]).toEqual([A]);
  });
});

describe("isAdminViewer", () => {
  const admins = parseAdminUserIds(A);

  it("accepts a listed member", () => {
    expect(isAdminViewer({ status: "member", userId: A }, admins)).toBe(true);
    expect(isAdminViewer({ status: "member", userId: A.toUpperCase() }, admins)).toBe(true);
  });

  it("M2, M4: rejects a member who is not listed", () => {
    expect(isAdminViewer({ status: "member", userId: B }, admins)).toBe(false);
  });

  it("M3: rejects anonymous visitors", () => {
    expect(isAdminViewer({ status: "anonymous" }, admins)).toBe(false);
  });

  it("rejects a listed user who is not a member", () => {
    expect(isAdminViewer({ status: "not_member", userId: A }, admins)).toBe(false);
  });

  it("rejects everyone when the list is empty", () => {
    expect(isAdminViewer({ status: "member", userId: A }, parseAdminUserIds(""))).toBe(false);
  });
});
