import { describe, expect, it } from "vitest";
import { parseWorkoutItems, serializeWorkoutItems } from "./workout-items";

describe("workout items", () => {
  it("round-trips strength items including reorder", () => {
    const markdown = `## Back Squat

3 × 6–8

## Romanian Deadlift

3 × 8

## Bulgarian Split Squat

3 × 10 / leg`;
    const items = parseWorkoutItems(markdown);
    expect(items.map((i) => i.title)).toEqual([
      "Back Squat",
      "Romanian Deadlift",
      "Bulgarian Split Squat",
    ]);
    items[1]!.body = "3 × 8–10";
    const [first, second, third] = items;
    const reordered = [first!, third!, second!];
    const saved = serializeWorkoutItems(reordered);
    const again = parseWorkoutItems(saved);
    expect(again.map((i) => i.title)).toEqual([
      "Back Squat",
      "Bulgarian Split Squat",
      "Romanian Deadlift",
    ]);
    expect(again[2]!.body).toBe("3 × 8–10");
  });

  it("round-trips a running session", () => {
    const markdown = `## Warm-up

1 km easy

## Main

6 × 200m hard
200m walk/jog recovery

## Cooldown

1 km easy`;
    const items = parseWorkoutItems(markdown);
    expect(items).toHaveLength(3);
    expect(parseWorkoutItems(serializeWorkoutItems(items)).map((i) => i.title)).toEqual([
      "Warm-up",
      "Main",
      "Cooldown",
    ]);
  });

  it("ignores empty items when serializing", () => {
    expect(
      serializeWorkoutItems([
        { id: "1", title: "", body: "" },
        { id: "2", title: "Back Squat", body: "3 × 6–8" },
      ]),
    ).toContain("## Back Squat");
  });
});
