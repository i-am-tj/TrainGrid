"use client";

import { useState } from "react";
import { EQUIPMENT_LABELS, EQUIPMENT_TYPES, type EquipmentType } from "@/lib/domain";
import type { PlannedItem } from "@/lib/data/model";
import { parseYouTubeUrl } from "@/lib/youtube";
import { btnSecondary, fieldClass } from "@/lib/ui";

/**
 * Editor for the structured fields of workout items (D-04). Name and
 * instruction are always visible; rest, target, notes, equipment and video
 * sit under "More details" to keep the form compact.
 *
 * Each item is posted as parallel itemXxx fields. An item's id is posted so
 * the server can keep it; the server ignores ids that do not already belong
 * to the routine or session being edited.
 */

type Draft = PlannedItem & { key: string; persisted: boolean };

function blank(): Draft {
  return {
    key: crypto.randomUUID(),
    persisted: false,
    id: "",
    name: "",
    instruction: "",
    rest: "",
    target: "",
    notes: "",
    equipment: [],
    videoUrl: null,
  };
}

function hasDetails(item: PlannedItem): boolean {
  return Boolean(item.rest || item.target || item.notes || item.equipment.length || item.videoUrl);
}

export function WorkoutItemEditor({ initial }: { initial: PlannedItem[] }) {
  const [items, setItems] = useState<Draft[]>(
    initial.length > 0
      ? initial.map((item) => ({ ...item, key: item.id, persisted: true }))
      : [blank()],
  );

  function update(index: number, patch: Partial<PlannedItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function toggleEquipment(index: number, tag: EquipmentType) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const has = item.equipment.includes(tag);
        return {
          ...item,
          equipment: has ? item.equipment.filter((e) => e !== tag) : [...item.equipment, tag],
        };
      }),
    );
  }

  function move(index: number, dir: -1 | 1) {
    setItems((current) => {
      const target = index + dir;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const videoDraft = item.videoUrl ?? "";
        const videoInvalid = Boolean(videoDraft.trim()) && !parseYouTubeUrl(videoDraft);
        const n = index + 1;
        return (
          <div key={item.key} className="rounded-md border border-line bg-white p-3">
            <input type="hidden" name="itemId" value={item.persisted ? item.id : ""} />
            <input type="hidden" name="itemEquipment" value={item.equipment.join(",")} />

            <label className="block text-sm font-medium">
              Workout item {n}
              <input
                name="itemName"
                className={fieldClass}
                value={item.name}
                maxLength={200}
                placeholder="Exercise or step (e.g. Back Squat)"
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </label>
            <label className="mt-2 block text-sm font-medium">
              Instruction
              <textarea
                name="itemInstruction"
                className={`${fieldClass} min-h-16`}
                value={item.instruction}
                maxLength={2000}
                placeholder="Planned work, e.g. 4 × 5–6"
                onChange={(e) => update(index, { instruction: e.target.value })}
              />
            </label>

            <details className="mt-2" open={hasDetails(item)}>
              <summary className="cursor-pointer text-sm font-medium text-stone-700">
                More details
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                  Rest
                  <input
                    name="itemRest"
                    className={fieldClass}
                    value={item.rest}
                    maxLength={200}
                    placeholder="e.g. 2–3 min"
                    onChange={(e) => update(index, { rest: e.target.value })}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Target
                  <input
                    name="itemTarget"
                    className={fieldClass}
                    value={item.target}
                    maxLength={200}
                    placeholder="e.g. RPE 7–8, pace, HR zone"
                    onChange={(e) => update(index, { target: e.target.value })}
                  />
                </label>
              </div>
              <label className="mt-2 block text-sm font-medium">
                Notes
                <textarea
                  name="itemNotes"
                  className={`${fieldClass} min-h-16`}
                  value={item.notes}
                  maxLength={4000}
                  onChange={(e) => update(index, { notes: e.target.value })}
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
                YouTube URL
                <input
                  name="itemVideo"
                  className={fieldClass}
                  value={videoDraft}
                  placeholder="https://www.youtube.com/watch?v=…"
                  inputMode="url"
                  onChange={(e) => update(index, { videoUrl: e.target.value || null })}
                />
              </label>
              {videoInvalid ? (
                <p className="mt-1 text-xs text-red-800">
                  Use a YouTube watch, youtu.be, or shorts link.
                </p>
              ) : null}
            </details>

            <div className="mt-3 flex flex-wrap gap-2">
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
                    current.length === 1 ? [blank()] : current.filter((_, i) => i !== index),
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
        onClick={() => setItems((current) => [...current, blank()])}
      >
        Add workout item
      </button>
    </div>
  );
}
