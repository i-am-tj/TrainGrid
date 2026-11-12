import { describe, expect, it } from "vitest";
import {
  OAUTH_PROVIDERS,
  classifyCallbackError,
  isOAuthProviderId,
  loginErrorMessage,
} from "./providers";

const params = (query: string) => new URLSearchParams(query);

describe("OAUTH_PROVIDERS", () => {
  it("offers exactly Google and GitHub", () => {
    expect(OAUTH_PROVIDERS.map((provider) => provider.id)).toEqual(["google", "github"]);
  });

  it("accepts only configured providers", () => {
    expect(isOAuthProviderId("google")).toBe(true);
    expect(isOAuthProviderId("github")).toBe(true);
    expect(isOAuthProviderId("apple")).toBe(false);
    expect(isOAuthProviderId("email")).toBe(false);
    expect(isOAuthProviderId(null)).toBe(false);
  });
});

describe("loginErrorMessage", () => {
  it("returns null when there is no error", () => {
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage("")).toBeNull();
  });

  it("returns fixed texts for known codes", () => {
    expect(loginErrorMessage("signin")).toMatch(/could not be completed/);
    expect(loginErrorMessage("email")).toMatch(/verified email/);
  });

  it("falls back to the generic text for anything else", () => {
    const generic = loginErrorMessage("signin");
    expect(loginErrorMessage("<script>alert(1)</script>")).toBe(generic);
    expect(loginErrorMessage("constructor")).toBe(generic);
    expect(loginErrorMessage("toString")).toBe(generic);
  });
});

describe("classifyCallbackError", () => {
  it("recognises a provider account without a usable email", () => {
    expect(
      classifyCallbackError(
        params(
          "error=server_error&error_code=unexpected_failure&error_description=Error+getting+user+email+from+external+provider",
        ),
      ),
    ).toBe("email");
    expect(classifyCallbackError(params("error_code=email_not_confirmed"))).toBe("email");
    expect(classifyCallbackError(params("error_description=Unverified+email+with+github"))).toBe(
      "email",
    );
  });

  it("is generic for everything else", () => {
    expect(classifyCallbackError(params(""))).toBe("signin");
    expect(classifyCallbackError(params("error=access_denied&error_description=User+denied"))).toBe(
      "signin",
    );
    expect(classifyCallbackError(params("error_description=emailer+exploded"))).toBe("signin");
  });
});
