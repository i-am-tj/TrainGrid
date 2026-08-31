import { mkdir, readdir, readFile, unlink } from "fs/promises";
import path from "path";
import matter from "gray-matter";
import {
  isSessionType,
  type SessionTemplate,
  type SessionType,
} from "./domain";
import { writeAtomic } from "./fs-utils";
import { getTemplatesDir } from "./paths";
import { slugify, uniqueId } from "./slug";

function coerceTemplate(
  id: string,
  data: Record<string, unknown>,
  body: string,
): SessionTemplate {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  const typeRaw = typeof data.type === "string" ? data.type : "other";
  const type: SessionType = isSessionType(typeRaw) ? typeRaw : "other";
  const description =
    typeof data.description === "string" ? data.description : "";
  return {
    id,
    name,
    type,
    description,
    body: body.replace(/^\n+/, "").trimEnd() + (body.trim() ? "\n" : ""),
  };
}

export async function listTemplates(): Promise<SessionTemplate[]> {
  const dir = getTemplatesDir();
  await mkdir(dir, { recursive: true });
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  const templates: SessionTemplate[] = [];
  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    const parsed = matter(raw);
    const fileId = file.replace(/\.md$/, "");
    const id =
      typeof parsed.data.id === "string" && parsed.data.id
        ? parsed.data.id
        : fileId;
    templates.push(coerceTemplate(id, parsed.data as Record<string, unknown>, parsed.content));
  }
  templates.sort((a, b) => a.name.localeCompare(b.name));
  return templates;
}

export async function getTemplate(
  id: string,
): Promise<SessionTemplate | null> {
  const templates = await listTemplates();
  return templates.find((t) => t.id === id) ?? null;
}

export function templatePath(id: string): string {
  return path.join(getTemplatesDir(), `${id}.md`);
}

export async function saveTemplate(template: SessionTemplate): Promise<void> {
  const frontmatter: Record<string, string> = {
    id: template.id,
    name: template.name,
    type: template.type,
  };
  if (template.description.trim()) {
    frontmatter.description = template.description.trim();
  }
  const serialized = matter.stringify(
    template.body.trim() ? `${template.body.trim()}\n` : "",
    frontmatter,
  );
  await writeAtomic(templatePath(template.id), serialized);
}

export async function createTemplateId(name: string): Promise<string> {
  const existing = new Set((await listTemplates()).map((t) => t.id));
  return uniqueId(slugify(name), existing);
}

export async function deleteTemplateFile(id: string): Promise<void> {
  await unlink(templatePath(id));
}

export async function replaceAllTemplates(
  templates: SessionTemplate[],
): Promise<void> {
  const dir = getTemplatesDir();
  await mkdir(dir, { recursive: true });
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    await unlink(path.join(dir, file));
  }
  for (const template of templates) {
    await saveTemplate(template);
  }
}
