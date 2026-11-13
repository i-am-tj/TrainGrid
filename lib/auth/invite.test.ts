import { describe, expect, it } from "vitest";
import { loginErrorForInvite, parseInviteResult } from "./invite";

describe("parseInviteResult", () => {
  it("accepts only the three known results", () => {
    expect(parseInviteResult("member")).toBe("member");
    expect(parseInviteResult("not_invited")).toBe("not_invited");
    expect(parseInviteResult("unverified_email")).toBe("unverified_email");
    expect(parseInviteResult("linked_identity")).toBe("linked_identity");
    expect(parseInviteResult("MEMBER")).toBeNull();
    expect(parseInviteResult(true)).toBeNull();
    expect(parseInviteResult(null)).toBeNull();
    expect(parseInviteResult({ result: "member" })).toBeNull();
  });
});

describe("loginErrorForInvite", () => {
  it("lets only an explicit member through", () => {
    expect(loginErrorForInvite("member")).toBeNull();
  });

  it("maps refusals to their messages", () => {
    expect(loginErrorForInvite("not_invited")).toBe("invite");
    expect(loginErrorForInvite("unverified_email")).toBe("email");
    // E2-D22: a linked identity invited as someone else is refused, never let in.
    expect(loginErrorForInvite("linked_identity")).toBe("linked");
  });

  it("refuses anything unexpected", () => {
    for (const value of [undefined, null, "", "ok", true, 1, [], {}]) {
      expect(loginErrorForInvite(value)).toBe("signin");
    }
  });
});
