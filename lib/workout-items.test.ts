import { describe, expect, it } from "vitest";
import { EQUIPMENT_TYPES } from "./domain";
import { parseEquipmentValues, parseWorkoutItems, serializeWorkoutItems } from "./workout-items";

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
        { id: "1", title: "", body: "", equipment: [], videoUrl: null },
        { id: "2", title: "Back Squat", body: "3 × 6–8", equipment: [], videoUrl: null },
      ]),
    ).toContain("## Back Squat");
  });

  it("round-trips equipment and YouTube URLs", () => {
    const markdown = `## Bulgarian Split Squat

3 × 10 / side

Equipment: Dumbbell, Bench
Video: https://youtu.be/dQw4w9WgXcQ

## Push-up

3 × 12`;
    const items = parseWorkoutItems(markdown);
    expect(items[0]!.equipment).toEqual(["dumbbell", "bench"]);
    expect(items[0]!.videoUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(items[1]!.equipment).toEqual([]);
    expect(items[1]!.videoUrl).toBeNull();
    const again = parseWorkoutItems(serializeWorkoutItems(items));
    expect(again[0]!.equipment).toEqual(["dumbbell", "bench"]);
    expect(again[0]!.videoUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("keeps older items without metadata compatible", () => {
    const items = parseWorkoutItems("## Easy Jog\n\n5–10 min");
    expect(items[0]!.equipment).toEqual([]);
    expect(items[0]!.videoUrl).toBeNull();
  });

  it("drops invalid video URLs and unknown equipment", () => {
    const items = parseWorkoutItems(`## Row

3 × 8

Equipment: barbell, spaceship, Free Body
Video: https://example.com/not-youtube`);
    expect(items[0]!.equipment).toEqual(["barbell"]);
    expect(items[0]!.videoUrl).toBeNull();
  });
});

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
