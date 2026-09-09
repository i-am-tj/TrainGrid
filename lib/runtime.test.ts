import { describe, expect, it, afterEach } from "vitest";
import { isPublishedReadonly } from "./runtime";

describe("isPublishedReadonly", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env.TRAINGRID_READONLY = original.TRAINGRID_READONLY;
    process.env.VERCEL = original.VERCEL;
    if (original.TRAINGRID_READONLY === undefined) delete process.env.TRAINGRID_READONLY;
    if (original.VERCEL === undefined) delete process.env.VERCEL;
  });

  it("is writable by default locally", () => {
    delete process.env.TRAINGRID_READONLY;
    delete process.env.VERCEL;
    expect(isPublishedReadonly()).toBe(false);
  });

  it("is readonly on Vercel", () => {
    delete process.env.TRAINGRID_READONLY;
    process.env.VERCEL = "1";
    expect(isPublishedReadonly()).toBe(true);
  });

  it("respects TRAINGRID_READONLY override", () => {
    process.env.VERCEL = "1";
    process.env.TRAINGRID_READONLY = "false";
    expect(isPublishedReadonly()).toBe(false);
    delete process.env.VERCEL;
    process.env.TRAINGRID_READONLY = "true";
    expect(isPublishedReadonly()).toBe(true);
  });
});
