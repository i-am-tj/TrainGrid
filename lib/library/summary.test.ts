import { describe, expect, it } from "vitest";
import { equipmentUsed, itemCountText, routineAtAGlance } from "./summary";

describe("routine at a glance (E2-03)", () => {
  it("collects equipment once each, in canonical order, ignoring unknown tags", () => {
    const items = [
      { equipment: ["machine", "barbell"] },
      { equipment: ["barbell", "bench"] },
      { equipment: ["hoverboard", "bodyweight"] },
      { equipment: [] },
    ];
    expect(equipmentUsed(items)).toEqual(["bodyweight", "barbell", "machine", "bench"]);
    expect(equipmentUsed([])).toEqual([]);
  });

  it("counts items in words", () => {
    expect(itemCountText(0)).toBe("0 items");
    expect(itemCountText(1)).toBe("1 item");
    expect(itemCountText(6)).toBe("6 items");
  });

  it("names equipment only when the content does", () => {
    expect(routineAtAGlance(6, ["barbell", "bench"])).toBe("6 items · Barbell, Bench");
    expect(routineAtAGlance(5, [])).toBe("5 items");
    expect(routineAtAGlance(1, ["resistance-band"])).toBe("1 item · Resistance Band");
  });
});
