import {
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  isEquipmentType,
  type EquipmentType,
  type WorkoutItem,
} from "./domain";
import { parseYouTubeUrl } from "./youtube";

const LABEL_TO_EQUIPMENT = new Map(
  EQUIPMENT_TYPES.map((id) => [EQUIPMENT_LABELS[id].toLowerCase(), id]),
);

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

function extractMeta(rawBody: string): {
  body: string;
  equipment: EquipmentType[];
  videoUrl: string | null;
} {
  const equipment: EquipmentType[] = [];
  let videoUrl: string | null = null;
  const kept: string[] = [];
  for (const line of rawBody.replace(/\r\n/g, "\n").split("\n")) {
    const equipmentMatch = /^\s*equipment:\s*(.*)$/i.exec(line);
    if (equipmentMatch) {
      equipment.push(...parseEquipmentValues(equipmentMatch[1] ?? ""));
      continue;
    }
    const videoMatch = /^\s*video:\s*(.*)$/i.exec(line);
    if (videoMatch) {
      videoUrl = parseYouTubeUrl(videoMatch[1] ?? "");
      continue;
    }
    kept.push(line);
  }
  const unique = EQUIPMENT_TYPES.filter((id) => equipment.includes(id));
  return {
    body: kept.join("\n").replace(/^\n+/, "").replace(/\n+$/, "").trim(),
    equipment: unique,
    videoUrl,
  };
}

export function parseWorkoutItems(markdown: string): WorkoutItem[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const chunks = text.split(/(?=^## )/m).filter((chunk) => chunk.trim());
  return chunks.map((chunk, index) => {
    const lines = chunk.replace(/\n+$/, "").split("\n");
    const first = lines[0] ?? "";
    if (first.startsWith("## ")) {
      const meta = extractMeta(lines.slice(1).join("\n").replace(/^\n/, "").trim());
      return {
        id: `item-${index}`,
        title: first.slice(3).trim(),
        ...meta,
      };
    }
    const meta = extractMeta(chunk.trim());
    return {
      id: `item-${index}`,
      title: "",
      ...meta,
    };
  });
}

export function serializeWorkoutItems(items: WorkoutItem[]): string {
  return items
    .map((item) => {
      const title = item.title.trim();
      const body = item.body.trim();
      const equipment = (item.equipment ?? []).filter(isEquipmentType);
      const unique = EQUIPMENT_TYPES.filter((id) => equipment.includes(id));
      const videoUrl = parseYouTubeUrl(item.videoUrl ?? "");
      const meta: string[] = [];
      if (unique.length > 0) {
        meta.push(`Equipment: ${unique.map((id) => EQUIPMENT_LABELS[id]).join(", ")}`);
      }
      if (videoUrl) {
        meta.push(`Video: ${videoUrl}`);
      }
      const parts = [body, ...meta].filter(Boolean);
      const content = parts.join("\n\n");
      if (title) {
        return content ? `## ${title}\n\n${content}` : `## ${title}`;
      }
      return content;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function newWorkoutItem(): WorkoutItem {
  return {
    id: `item-${crypto.randomUUID()}`,
    title: "",
    body: "",
    equipment: [],
    videoUrl: null,
  };
}
