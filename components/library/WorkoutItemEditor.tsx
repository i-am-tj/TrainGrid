"use client";

import { useState } from "react";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  type EquipmentType,
  type WorkoutItem,
} from "@/lib/domain";
import { newWorkoutItem } from "@/lib/workout-items";
import { parseYouTubeUrl } from "@/lib/youtube";
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

  function toggleEquipment(index: number, tag: EquipmentType) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const has = item.equipment.includes(tag);
        return {
          ...item,
          equipment: has
            ? item.equipment.filter((e) => e !== tag)
            : [...item.equipment, tag],
        };
      }),
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
      {items.map((item, index) => {
        const videoDraft = item.videoUrl ?? "";
        const videoInvalid = Boolean(videoDraft.trim()) && !parseYouTubeUrl(videoDraft);
        return (
          <div
            key={item.id}
            className="rounded-md border border-line bg-white p-3"
          >
            <input type="hidden" name="itemTitle" value={item.title} />
            <input type="hidden" name="itemBody" value={item.body} />
            <input
              type="hidden"
              name="itemEquipment"
              value={item.equipment.join(",")}
            />
            <input type="hidden" name="itemVideo" value={item.videoUrl ?? ""} />
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
                placeholder="4 × 5–6&#10;Rest: 2–3 min&#10;Target: RPE 7–8"
                onChange={(e) => update(index, { body: e.target.value })}
              />
            </label>
            <fieldset className="mt-3">
              <legend className="text-sm font-medium">Equipment</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EQUIPMENT_TYPES.map((tag) => {
                  const on = item.equipment.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${
                        on
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
                      }`}
                      onClick={() => toggleEquipment(index, tag)}
                    >
                      {EQUIPMENT_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="mt-3 block text-sm font-medium">
              YouTube URL (optional)
              <input
                className={fieldClass}
                value={videoDraft}
                placeholder="https://www.youtube.com/watch?v=…"
                inputMode="url"
                onChange={(e) =>
                  update(index, { videoUrl: e.target.value || null })
                }
              />
            </label>
            {videoInvalid ? (
              <p className="mt-1 text-xs text-red-800">
                Use a YouTube watch, youtu.be, or shorts URL. Invalid links are
                not saved.
              </p>
            ) : null}
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
        );
      })}
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
