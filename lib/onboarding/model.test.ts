import { describe, expect, it } from "vitest";
import { showFirstSessionInvite } from "./model";

describe("showFirstSessionInvite", () => {
  it("invites a member who has never planned a session", () => {
    expect(showFirstSessionInvite(false, false)).toBe(true);
  });

  it("steps aside once any session is planned", () => {
    expect(showFirstSessionInvite(true, false)).toBe(false);
  });

  it("stays hidden once dismissed, or when it could not be read", () => {
    expect(showFirstSessionInvite(false, true)).toBe(false);
    expect(showFirstSessionInvite(null, false)).toBe(false);
  });
});
