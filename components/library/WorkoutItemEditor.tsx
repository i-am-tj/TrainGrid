"use client";

import { useState } from "react";
import type { WorkoutItem } from "@/lib/domain";
import { newWorkoutItem } from "@/lib/workout-items";
import { btnSecondary, fieldClass } from "@/lib/ui";

export function WorkoutItemEditor({
  initial,
}: {
  initial: WorkoutItem[];
}) {
  const [items, setItems] = useState<WorkoutItem[]>(
    initial.length > 0 ? initial : [newWorkoutItem()],
  );

  function update(index: number, patch: Partial<WorkoutItem>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function move(index: number, dir: -1 | 1) {
    setItems((current) => {
      const next = [...current];
      const target = index + dir;
      if (target < 0 || target >= next.length) return current;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="rounded-md border border-line bg-white p-3"
        >
          <input type="hidden" name="itemTitle" value={item.title} />
          <input type="hidden" name="itemBody" value={item.body} />
          <label className="block text-sm font-medium">
            Workout item {index + 1}
            <input
              className={fieldClass}
              value={item.title}
              placeholder="Title (e.g. Back Squat)"
              onChange={(e) => update(index, { title: e.target.value })}
            />
          </label>
          <label className="mt-2 block text-sm font-medium">
            Details
            <textarea
              className={`${fieldClass} min-h-20`}
              value={item.body}
              placeholder="3 × 6–8"
              onChange={(e) => update(index, { body: e.target.value })}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => move(index, -1)}
              disabled={index === 0}
            >
              Up
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => move(index, 1)}
              disabled={index === items.length - 1}
            >
              Down
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() =>
                setItems((current) =>
                  current.length === 1
                    ? [newWorkoutItem()]
                    : current.filter((_, i) => i !== index),
                )
              }
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className={btnSecondary}
        onClick={() => setItems((current) => [...current, newWorkoutItem()])}
      >
        Add workout item
      </button>
    </div>
  );
}
