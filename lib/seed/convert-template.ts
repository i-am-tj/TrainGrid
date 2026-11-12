import { createHash } from "crypto";
import matter from "gray-matter";
import { isSessionType, type EquipmentType, type SessionType } from "../domain";
import { parseEquipmentValues } from "../workout-items";
import { parseYouTubeUrl } from "../youtube";

/**
 * One-time conversion of the legacy Markdown templates (data/templates/*.md)
 * into GLOBAL routines with structured workout items (D-04, D-16).
 *
 * This is seed tooling only. The running application never parses Markdown
 * or "Rest:" / "Target:" lines.
 *
 * Within each "## " section:
 *   Rest: …                → rest
 *   Target: … / Intensity: → target
 *   Equipment: …           → equipment tags
 *   Video: …               → video_url (YouTube only)
 *   first paragraph        → instruction (the planned work)
 *   later paragraphs       → notes
 */

export type SeedItem = {
  id: string;
  name: string;
  instruction: string;
  rest: string;
  target: string;
  notes: string;
  equipment: EquipmentType[];
  videoUrl: string | null;
};

export type SeedRoutine = {
  id: string;
  slug: string;
  name: string;
  category: SessionType;
  description: string;
  items: SeedItem[];
};

/** Fixed namespace so the same template always gets the same ids, in every environment. */
const NAMESPACE = "6f3c2a7e-1d4b-4e8f-9a2c-5b7d1e0f3a91";

/** RFC 4122 version 5 (name-based, SHA-1) UUID. */
export function uuidV5(name: string, namespace = NAMESPACE): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const META = /^\s*(rest|target|intensity|equipment|video)\s*:\s*(.*)$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function joinValues(values: string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(" · ");
}

export function convertSection(slug: string, index: number, title: string, body: string): SeedItem {
  const rest: string[] = [];
  const target: string[] = [];
  const equipment: string[] = [];
  const videos: string[] = [];
  const kept: string[] = [];

  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const meta = META.exec(line);
    if (!meta) {
      kept.push(line.trimEnd());
      continue;
    }
    const value = meta[2]!.trim();
    switch (meta[1]!.toLowerCase()) {
      case "rest":
        rest.push(value);
        break;
      case "target":
      case "intensity":
        target.push(value);
        break;
      case "equipment":
        equipment.push(value);
        break;
      case "video":
        videos.push(value);
        break;
    }
  }

  const paragraphs = kept
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const videoUrl = videos.map(parseYouTubeUrl).find((url): url is string => url !== null) ?? null;

  return {
    id: uuidV5(`routine-item:${slug}:${index}`),
    name: title.trim(),
    instruction: paragraphs[0] ?? "",
    rest: joinValues(rest),
    target: joinValues(target),
    notes: paragraphs.slice(1).join("\n\n"),
    equipment: parseEquipmentValues(equipment.join(", ")),
    videoUrl,
  };
}

export function convertTemplate(fileSlug: string, markdown: string): SeedRoutine {
  const parsed = matter(markdown);
  const data = parsed.data as Record<string, unknown>;

  const slug = typeof data.id === "string" && data.id ? data.id : fileSlug;
  if (!SLUG.test(slug)) throw new Error(`Template ${fileSlug}: invalid slug "${slug}"`);

  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new Error(`Template ${fileSlug}: missing name`);

  const type = typeof data.type === "string" ? data.type : "other";
  if (!isSessionType(type)) throw new Error(`Template ${fileSlug}: unknown type "${type}"`);

  const description = typeof data.description === "string" ? data.description.trim() : "";

  const sections = parsed.content
    .replace(/\r\n/g, "\n")
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const newline = chunk.indexOf("\n");
      return newline === -1
        ? { title: chunk, body: "" }
        : { title: chunk.slice(0, newline), body: chunk.slice(newline + 1) };
    });

  const items = sections.map((section, index) =>
    convertSection(slug, index, section.title, section.body),
  );
  for (const item of items) {
    if (!item.name) throw new Error(`Template ${fileSlug}: a section has no title`);
  }

  return {
    id: uuidV5(`routine:${slug}`),
    slug,
    name,
    category: type,
    description,
    items,
  };
}

function sql(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

function sqlArray(values: string[]): string {
  return values.length === 0 ? "'{}'::text[]" : `array[${values.map(sql).join(", ")}]::text[]`;
}

/**
 * Idempotent SQL that creates or updates every GLOBAL routine and its items.
 * Ids are deterministic, so running it again (or in another environment)
 * updates the same rows. Items removed from a template are removed from its
 * routine. Routines whose template file was deleted are left alone.
 */
export function seedSql(routines: SeedRoutine[]): string {
  const lines: string[] = [
    "-- GLOBAL routines generated from data/templates/*.md.",
    "-- Do not edit by hand: run `npm run seed:generate` after changing a template.",
    "-- Generic training content only. No personal data.",
    "",
    "begin;",
    "",
    "insert into public.routines (id, scope, owner_user_id, slug, name, category, description)",
    "values",
    routines
      .map(
        (routine) =>
          `  (${sql(routine.id)}, 'GLOBAL', null, ${sql(routine.slug)}, ${sql(routine.name)}, ${sql(routine.category)}, ${sql(routine.description)})`,
      )
      .join(",\n"),
    "on conflict (id) do update",
    "  set slug = excluded.slug,",
    "      name = excluded.name,",
    "      category = excluded.category,",
    "      description = excluded.description;",
    "",
    "delete from public.workout_items",
    ` where routine_id in (${routines.map((routine) => sql(routine.id)).join(", ")})`,
    `   and id not in (${routines.flatMap((routine) => routine.items.map((item) => sql(item.id))).join(", ")});`,
    "",
    "insert into public.workout_items",
    "  (id, routine_id, name, instruction, rest, target, notes, equipment, video_url, sort_order)",
    "values",
    routines
      .flatMap((routine) =>
        routine.items.map(
          (item, index) =>
            `  (${sql(item.id)}, ${sql(routine.id)}, ${sql(item.name)}, ${sql(item.instruction)}, ${sql(item.rest)}, ${sql(item.target)}, ${sql(item.notes)}, ${sqlArray(item.equipment)}, ${sql(item.videoUrl)}, ${index})`,
        ),
      )
      .join(",\n"),
    "on conflict (id) do update",
    "  set routine_id = excluded.routine_id,",
    "      name = excluded.name,",
    "      instruction = excluded.instruction,",
    "      rest = excluded.rest,",
    "      target = excluded.target,",
    "      notes = excluded.notes,",
    "      equipment = excluded.equipment,",
    "      video_url = excluded.video_url,",
    "      sort_order = excluded.sort_order;",
    "",
    "commit;",
    "",
  ];
  return lines.join("\n");
}
