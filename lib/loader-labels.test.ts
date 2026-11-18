import { describe, expect, it } from "vitest";
import { loaderLabelFor } from "./loader-labels";

describe("loaderLabelFor", () => {
  it("names the planner as the calendar, including the current-week redirect", () => {
    expect(loaderLabelFor("/week/current")).toBe("Loading your calendar…");
    expect(loaderLabelFor("/week/2026-W47")).toBe("Loading your calendar…");
  });

  it("keeps a generic label for the add-session form and unknown pages", () => {
    expect(loaderLabelFor("/week/2026-W47/add")).toBe("Loading page…");
    expect(loaderLabelFor("/library/7f0c")).toBe("Loading page…");
    expect(loaderLabelFor("/weekly")).toBe("Loading page…");
  });

  it("matches the section loaders of home, library, invitations and the landing page", () => {
    expect(loaderLabelFor("/home")).toBe("Loading your home…");
    expect(loaderLabelFor("/profile")).toBe("Loading your profile…");
    expect(loaderLabelFor("/library")).toBe("Loading routines…");
    expect(loaderLabelFor("/admin/invitations")).toBe("Loading invitations…");
    expect(loaderLabelFor("/")).toBe("Loading TrainGrid…");
  });
});
