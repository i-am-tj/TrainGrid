import { EQUIPMENT_LABELS, EQUIPMENT_TYPES, isEquipmentType, type EquipmentType } from "./domain";

const LABEL_TO_EQUIPMENT = new Map(
  EQUIPMENT_TYPES.map((id) => [EQUIPMENT_LABELS[id].toLowerCase(), id]),
);

/** Parses equipment written as labels or ids ("Barbell, resistance band"). Used by seed tooling. */
export function parseEquipmentValues(raw: string): EquipmentType[] {
  const seen = new Set<EquipmentType>();
  for (const part of raw.split(/[,;|]/)) {
    const token = part.trim().toLowerCase().replace(/\s+/g, "-");
    if (!token) continue;
    const fromLabel = LABEL_TO_EQUIPMENT.get(part.trim().toLowerCase());
    const id = fromLabel ?? (isEquipmentType(token) ? token : null);
    if (id) seen.add(id);
  }
  return EQUIPMENT_TYPES.filter((id) => seen.has(id));
}
