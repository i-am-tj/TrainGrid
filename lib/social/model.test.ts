import { describe, expect, it } from "vitest";
import {
  RESERVED_USERNAMES,
  captionSchema,
  commentBodySchema,
  countLabel,
  decodeCursor,
  encodeCursor,
  followLabel,
  formatMinutes,
  formatSessionDate,
  normaliseUsername,
  pageNumber,
  postInputSchema,
  safeAvatarUrl,
  safeReturnPath,
  socialInitials,
  socialProfileInputSchema,
  suggestUsername,
  summaryParts,
  timeAgo,
  usernameProblem,
  workoutParts,
} from "./model";

describe("usernames", () => {
  it("normalises what people type", () => {
    expect(normaliseUsername("  @Ada_L ")).toBe("ada_l");
    expect(normaliseUsername("@@BEA")).toBe("bea");
  });

  it.each([
    ["ada", null],
    ["ada_lovelace", null],
    ["a1b", null],
    ["x".repeat(30), null],
  ])("accepts %s", (name, problem) => {
    expect(usernameProblem(name)).toBe(problem);
  });

  it.each([
    ["ab", /at least 3/],
    ["x".repeat(31), /at most 30/],
    ["ada lovelace", /letters, numbers and underscores/],
    ["ada-l", /letters, numbers and underscores/],
    ["_ada", /Start and end/],
    ["ada_", /Start and end/],
    ["ad__a", /double underscores/],
    ["settings", /reserved/],
    ["me", /at least 3/],
  ])("refuses %s", (name, message) => {
    expect(usernameProblem(name)).toMatch(message);
  });

  it("keeps the reserved words in step with the routes", () => {
    for (const route of ["feed", "people", "requests", "settings", "followers", "following", "posts"]) {
      expect(RESERVED_USERNAMES.has(route)).toBe(true);
    }
  });

  it("suggests a valid username from a name or email", () => {
    expect(suggestUsername("Ada Lovelace", "ada@x.dev")).toBe("ada_lovelace");
    expect(suggestUsername("Zoë Ångström", null)).toBe("zoe_angstrom");
    expect(suggestUsername(null, "bea.k+tg@example.test")).toBe("bea_k_tg");
    expect(suggestUsername("Al", null)).toBe("al_trains");
    expect(suggestUsername("Admin", null)).toBe("");
    const long = suggestUsername("A".repeat(50), null);
    expect(usernameProblem(long)).toBeNull();
  });
});

describe("profile input", () => {
  const base = { username: "Ada_L", displayName: " Ada ", bio: "Runs\n\nearly ", visibility: "private" as const, useIdentityAvatar: false };

  it("cleans and validates", () => {
    expect(socialProfileInputSchema.parse(base)).toEqual({
      username: "ada_l",
      displayName: "Ada",
      bio: "Runs early",
      visibility: "private",
      useIdentityAvatar: false,
    });
  });

  it("refuses empty names, long bios and unknown visibilities", () => {
    expect(socialProfileInputSchema.safeParse({ ...base, displayName: "  " }).success).toBe(false);
    expect(socialProfileInputSchema.safeParse({ ...base, displayName: "x".repeat(61) }).success).toBe(false);
    expect(socialProfileInputSchema.safeParse({ ...base, bio: "x".repeat(161) }).success).toBe(false);
    expect(socialProfileInputSchema.safeParse({ ...base, visibility: "everyone" }).success).toBe(false);
  });
});

describe("post input", () => {
  it("trims captions and squeezes blank lines", () => {
    expect(captionSchema.parse("  Good\r\n\r\n\r\n\r\nrun  ")).toBe("Good\n\nrun");
    expect(captionSchema.parse("")).toBe("");
  });

  it("limits captions to 500 characters and needs a session id", () => {
    expect(captionSchema.safeParse("x".repeat(500)).success).toBe(true);
    expect(captionSchema.safeParse("x".repeat(501)).success).toBe(false);
    expect(postInputSchema.safeParse({ sessionId: "nope", caption: "", showsDuration: false }).success).toBe(false);
  });
});

describe("cursors", () => {
  const cursor = { createdAt: "2026-11-22T10:00:00.123456+00:00", id: "6f1c3c55-9a5e-4c1b-9b7e-2f1a7d3e8c40" };

  it("round-trips", () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([undefined, "", "!!!", Buffer.from("x|y").toString("base64url"), Buffer.from(`${cursor.createdAt}|${cursor.id}|z`).toString("base64url"), "a".repeat(201)])(
    "rejects %s",
    (raw) => {
      expect(decodeCursor(raw)).toBeNull();
    },
  );

  it("reads page numbers defensively", () => {
    expect(pageNumber("3")).toBe(3);
    expect(pageNumber("0")).toBe(1);
    expect(pageNumber("1.5")).toBe(1);
    expect(pageNumber(["2"])).toBe(1);
    expect(pageNumber("100000")).toBe(1);
  });
});

describe("wording", () => {
  it("formats session dates and durations", () => {
    expect(formatSessionDate("2026-11-17", 2026)).toBe("Tue 17 Nov");
    expect(formatSessionDate("2025-11-17", 2026)).toBe("Mon 17 Nov 2025");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(95)).toBe("1 h 35 min");
  });

  it("summarises a session in reading order, duration only when shared", () => {
    expect(summaryParts({ name: "Legs", category: "strength", date: "2026-11-17", durationMinutes: 60 }, 2026)).toEqual([
      "Lift",
      "Tue 17 Nov",
      "1 h",
    ]);
    expect(summaryParts({ name: "Run", category: "running", date: "2026-11-17", durationMinutes: null }, 2026)).toEqual(["Run", "Tue 17 Nov"]);
  });

  it("says how long ago", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(timeAgo("2026-11-22T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-22T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-11-22T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-11-20T12:00:00Z", now)).toBe("2 d ago");
    expect(timeAgo("2026-10-01T12:00:00Z", now)).toBe("Thu 1 Oct");
    expect(timeAgo("not a date", now)).toBe("");
  });

  it("labels the follow button for every relationship", () => {
    expect(followLabel({ visibility: "public", viewerFollow: null, followsViewer: null })).toBe("Follow");
    expect(followLabel({ visibility: "private", viewerFollow: null, followsViewer: null })).toBe("Request to follow");
    expect(followLabel({ visibility: "private", viewerFollow: "pending", followsViewer: null })).toBe("Requested");
    expect(followLabel({ visibility: "public", viewerFollow: "accepted", followsViewer: null })).toBe("Following");
    expect(followLabel({ visibility: "public", viewerFollow: null, followsViewer: "accepted" })).toBe("Follow back");
  });

  it("makes initials", () => {
    expect(socialInitials("Ada Lovelace", "ada")).toBe("AL");
    expect(socialInitials("  ", "bea")).toBe("B");
    expect(socialInitials("émile", "e")).toBe("É");
  });
});

describe("safety helpers", () => {
  it("shows only https avatars", () => {
    expect(safeAvatarUrl("https://avatars.githubusercontent.com/u/1")).toBe("https://avatars.githubusercontent.com/u/1");
    expect(safeAvatarUrl("http://example.test/a.png")).toBeNull();
    expect(safeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(safeAvatarUrl("not a url")).toBeNull();
    expect(safeAvatarUrl(null)).toBeNull();
  });

  it("follows only same-site return paths", () => {
    expect(safeReturnPath("/feed", "/x")).toBe("/feed");
    expect(safeReturnPath("//evil.test", "/x")).toBe("/x");
    expect(safeReturnPath("https://evil.test", "/x")).toBe("/x");
    expect(safeReturnPath("/\\evil.test", "/x")).toBe("/x");
    expect(safeReturnPath(undefined, "/x")).toBe("/x");
  });
});

describe("workout summaries, counts and comments", () => {
  it("lists only the workout totals that were shared", () => {
    expect(workoutParts({ completed: true, sets: 12, volume: 4250, unit: "kg" })).toEqual(["12 sets", "4,250 kg lifted"]);
    expect(workoutParts({ completed: true, sets: 1, volume: 18500.5, unit: "lb" })).toEqual(["1 set", "18.5k lb lifted"]);
    expect(workoutParts({ completed: true, sets: null, volume: null, unit: null })).toEqual([]);
  });

  it("counts in words", () => {
    expect(countLabel(0, "like")).toBe("0 likes");
    expect(countLabel(1, "comment")).toBe("1 comment");
    expect(countLabel(1200, "like")).toBe("1,200 likes");
  });

  it("cleans and limits comments", () => {
    expect(commentBodySchema.parse("  Nice\r\n\r\n\r\nwork  ")).toBe("Nice\n\nwork");
    expect(commentBodySchema.safeParse("   ").success).toBe(false);
    expect(commentBodySchema.safeParse("x".repeat(500)).success).toBe(true);
    expect(commentBodySchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("shares no workout totals unless asked", () => {
    expect(postInputSchema.parse({ sessionId: "6f1c3c55-9a5e-4c1b-9b7e-2f1a7d3e8c40", caption: "", showsDuration: false })).toMatchObject({
      showsSets: false,
      showsVolume: false,
    });
  });
});
