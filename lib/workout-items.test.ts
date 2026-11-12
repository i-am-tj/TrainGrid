import { describe, expect, it } from "vitest";
import { EQUIPMENT_TYPES } from "./domain";
import { parseEquipmentValues } from "./workout-items";

describe("equipment parsing", () => {
  it("accepts labels and slugs and ignores junk", () => {
    expect(parseEquipmentValues("Dumbbell, bench")).toEqual(["dumbbell", "bench"]);
    expect(parseEquipmentValues("resistance-band")).toEqual(["resistance-band"]);
    expect(parseEquipmentValues("spaceship")).toEqual([]);
  });

  it("lists the controlled equipment set", () => {
    expect(EQUIPMENT_TYPES).toContain("bodyweight");
    expect(EQUIPMENT_TYPES).toContain("plyometric-box");
  });
});
