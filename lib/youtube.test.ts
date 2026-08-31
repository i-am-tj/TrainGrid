import { describe, expect, it } from "vitest";
import { parseYouTubeUrl } from "./youtube";

describe("YouTube URLs", () => {
  it("accepts watch, short, and youtu.be links", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(parseYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("treats empty as absent and rejects junk", () => {
    expect(parseYouTubeUrl("")).toBeNull();
    expect(parseYouTubeUrl("   ")).toBeNull();
    expect(parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeUrl("not-a-url")).toBeNull();
  });
});
