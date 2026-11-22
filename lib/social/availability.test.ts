import { describe, expect, it } from "vitest";
import { DataError } from "@/lib/data/model";
import { SOCIAL_UNAVAILABLE_MESSAGE, SocialUnavailableError, isMissingSchemaError, socialFailure } from "./availability";

describe("social availability", () => {
  it.each(["PGRST205", "PGRST202", "42P01", "42883", "3F000"])("treats %s as a missing schema", (code) => {
    expect(isMissingSchemaError({ code })).toBe(true);
    expect(socialFailure({ code }, "Could not load posts.")).toBeInstanceOf(SocialUnavailableError);
  });

  it.each([null, undefined, {}, { code: null }, { code: "42501" }, { code: "23505" }, { code: "PGRST116" }])(
    "keeps other failures as plain errors (%j)",
    (error) => {
      expect(isMissingSchemaError(error)).toBe(false);
      const failure = socialFailure(error, "Could not load posts.");
      expect(failure).not.toBeInstanceOf(SocialUnavailableError);
      expect(failure.message).toBe("Could not load posts.");
    },
  );

  it("is a DataError, so server actions show its message on the form", () => {
    const error = new SocialUnavailableError();
    expect(error).toBeInstanceOf(DataError);
    expect(error.code).toBe("unavailable");
    expect(error.message).toBe(SOCIAL_UNAVAILABLE_MESSAGE);
  });
});
