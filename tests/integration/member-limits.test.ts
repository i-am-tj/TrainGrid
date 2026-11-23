import { afterAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers, integrationReady } from "./helpers";

describe.skipIf(!integrationReady)("concurrent feedback at the daily limit", () => {
  afterAll(deleteTestUsers);

  it("admits one of two simultaneous messages when one slot remains", async () => {
    const member = await createTestUser("feedback-limit");
    const message = { kind: "idea", message: "Local audit fixture" };
    const setup = await member.db.from("member_feedback").insert(Array.from({ length: 9 }, () => message));
    expect(setup.error).toBeNull();

    const send = async () => (await member.db.from("member_feedback").insert(message)).error;
    const results = await Promise.all([send(), send()]);
    expect(results.filter((error) => error === null)).toHaveLength(1);
    expect(results.find((error) => error !== null)?.message).toContain("feedback_rate_limited");
  });
});
