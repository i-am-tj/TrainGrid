import {
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  isEquipmentType,
  type EquipmentType,
} from "@/lib/domain";

/**
 * Every equipment tag used by any of the items, in canonical order, without
 * duplicates. Unknown tags are ignored.
 */
export function equipmentUsed(
  items: ReadonlyArray<{ equipment: readonly string[] }>,
): EquipmentType[] {
  const used = new Set(
    items.flatMap((item) => item.equipment).filter(isEquipmentType),
  );
  return EQUIPMENT_TYPES.filter((tag) => used.has(tag));
}

/** "1 item", "6 items". */
export function itemCountText(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

/**
 * What a routine asks for, at a glance: "6 items · Barbell, Bench".
 * Equipment is left out when no item names any; nothing is invented.
 */
export function routineAtAGlance(
  itemCount: number,
  equipment: readonly EquipmentType[],
): string {
  const count = itemCountText(itemCount);
  if (equipment.length === 0) return count;
  return `${count} · ${equipment.map((tag) => EQUIPMENT_LABELS[tag]).join(", ")}`;
}
