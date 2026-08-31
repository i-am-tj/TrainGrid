import type { WorkoutItem } from "./domain";

export function parseWorkoutItems(markdown: string): WorkoutItem[] {
  const text = markdown.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const chunks = text.split(/(?=^## )/m).filter((chunk) => chunk.trim());
  return chunks.map((chunk, index) => {
    const lines = chunk.replace(/\n+$/, "").split("\n");
    const first = lines[0] ?? "";
    if (first.startsWith("## ")) {
      return {
        id: `item-${index}`,
        title: first.slice(3).trim(),
        body: lines.slice(1).join("\n").replace(/^\n/, "").trim(),
      };
    }
    return {
      id: `item-${index}`,
      title: "",
      body: chunk.trim(),
    };
  });
}

export function serializeWorkoutItems(items: WorkoutItem[]): string {
  return items
    .map((item) => {
      const title = item.title.trim();
      const body = item.body.trim();
      if (title) {
        return body ? `## ${title}\n\n${body}` : `## ${title}`;
      }
      return body;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function newWorkoutItem(): WorkoutItem {
  return {
    id: `item-${crypto.randomUUID()}`,
    title: "",
    body: "",
  };
}
