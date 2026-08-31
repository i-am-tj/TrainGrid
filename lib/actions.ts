"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  BackupFile,
  IsoDay,
  ScheduledSession,
  SessionTemplate,
  SessionType,
} from "@/lib/domain";
import { isSessionType, sanitizeName } from "@/lib/domain";
import { parseBackupJson } from "@/lib/backup";
import { duplicateWeekSessions } from "@/lib/duplicate-week";
import { resolveSession, templatesById } from "@/lib/resolve-session";
import {
  deleteSession,
  listSessions,
  readSchedule,
  upsertSession,
  writeSchedule,
} from "@/lib/schedule";
import {
  createTemplateId,
  deleteTemplateFile,
  getTemplate,
  listTemplates,
  replaceAllTemplates,
  saveTemplate,
} from "@/lib/templates";
import { isValidTime, isValidWeekId } from "@/lib/week";
import { serializeWorkoutItems } from "@/lib/workout-items";

function revalidateAll() {
  revalidatePath("/", "layout");
}

function parseIsoDay(value: FormDataEntryValue | null): IsoDay {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 7) {
    throw new Error("Invalid day");
  }
  return n as IsoDay;
}

function parseType(value: FormDataEntryValue | null): SessionType {
  const raw = String(value ?? "");
  if (!isSessionType(raw)) throw new Error("Invalid session type");
  return raw;
}

function parseTime(form: FormData): string | null {
  const untimed = String(form.get("untimed") ?? "");
  if (untimed === "on" || untimed === "true") {
    return null;
  }
  const time = String(form.get("time") ?? "").trim();
  if (!time) return null;
  if (!isValidTime(time)) throw new Error("Invalid time");
  return time;
}

function parseDuration(form: FormData): number | null {
  const raw = String(form.get("durationMinutes") ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parseItemsFromForm(form: FormData): string {
  const titles = form.getAll("itemTitle").map((v) => String(v));
  const bodies = form.getAll("itemBody").map((v) => String(v));
  const items = titles.map((title, i) => ({
    id: `item-${i}`,
    title,
    body: bodies[i] ?? "",
  }));
  return serializeWorkoutItems(items);
}

export async function createScheduledSession(formData: FormData) {
  const weekId = String(formData.get("weekId") ?? "");
  if (!isValidWeekId(weekId)) throw new Error("Invalid week");
  const name = sanitizeName(String(formData.get("name") ?? ""));
  if (!name) throw new Error("Name is required");
  const from = String(formData.get("from") ?? "template");
  const templateIdRaw = String(formData.get("templateId") ?? "").trim();
  const templateId =
    from === "template" && templateIdRaw ? templateIdRaw : null;

  const session: ScheduledSession = {
    id: crypto.randomUUID(),
    name,
    type: parseType(formData.get("type")),
    weekId,
    day: parseIsoDay(formData.get("day")),
    time: parseTime(formData),
    durationMinutes: parseDuration(formData),
    notes: String(formData.get("notes") ?? "").trim(),
    templateId,
    bodySnapshot: templateId
      ? null
      : parseItemsFromForm(formData) || String(formData.get("body") ?? ""),
  };

  if (templateId) {
    const template = await getTemplate(templateId);
    if (!template) throw new Error("Template not found");
  }

  await upsertSession(session);
  revalidateAll();
  redirect(`/week/${weekId}?day=${session.day}`);
}

export async function updateScheduledSession(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const existing = (await listSessions()).find((s) => s.id === id);
  if (!existing) throw new Error("Session not found");

  const name = sanitizeName(String(formData.get("name") ?? ""));
  if (!name) throw new Error("Name is required");

  const replace = String(formData.get("replaceTemplateId") ?? "").trim();
  let templateId = existing.templateId;
  let bodySnapshot = existing.bodySnapshot;

  if (replace) {
    const template = await getTemplate(replace);
    if (!template) throw new Error("Template not found");
    templateId = replace;
    bodySnapshot = null;
  }

  const updated: ScheduledSession = {
    ...existing,
    name,
    type: parseType(formData.get("type")),
    weekId: String(formData.get("weekId") ?? existing.weekId),
    day: parseIsoDay(formData.get("day")),
    time: parseTime(formData),
    durationMinutes: parseDuration(formData),
    notes: String(formData.get("notes") ?? "").trim(),
    templateId,
    bodySnapshot,
  };

  if (!isValidWeekId(updated.weekId)) throw new Error("Invalid week");

  await upsertSession(updated);
  revalidateAll();
  redirect(`/session/${id}`);
}

export async function customizeScheduledSession(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const existing = (await listSessions()).find((s) => s.id === id);
  if (!existing) throw new Error("Session not found");
  const templates = templatesById(await listTemplates());
  const resolved = resolveSession(existing, templates);
  const body = parseItemsFromForm(formData) || resolved.body;

  await upsertSession({
    ...existing,
    bodySnapshot: body,
  });
  revalidateAll();
  redirect(`/session/${id}`);
}

export async function deleteScheduledSessionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const weekId = String(formData.get("weekId") ?? "");
  const day = String(formData.get("day") ?? "1");
  await deleteSession(id);
  revalidateAll();
  redirect(`/week/${weekId}?day=${day}`);
}

export async function duplicateWeekAction(formData: FormData) {
  const sourceWeekId = String(formData.get("sourceWeekId") ?? "");
  const destWeekId = String(formData.get("destWeekId") ?? "");
  if (!isValidWeekId(sourceWeekId) || !isValidWeekId(destWeekId)) {
    throw new Error("Invalid week");
  }
  if (sourceWeekId === destWeekId) {
    throw new Error("Choose a different week");
  }

  const file = await readSchedule();
  const copies = duplicateWeekSessions(
    file.sessions,
    sourceWeekId,
    destWeekId,
  );
  file.sessions.push(...copies);
  await writeSchedule(file);
  revalidateAll();
  redirect(`/week/${destWeekId}`);
}

export async function upsertTemplateAction(formData: FormData) {
  const existingId = String(formData.get("id") ?? "").trim();
  const name = sanitizeName(String(formData.get("name") ?? ""));
  if (!name) throw new Error("Name is required");
  const id = existingId || (await createTemplateId(name));
  const template: SessionTemplate = {
    id,
    name,
    type: parseType(formData.get("type")),
    description: String(formData.get("description") ?? "").trim(),
    body: parseItemsFromForm(formData),
  };
  await saveTemplate(template);
  revalidateAll();
  redirect(`/library/${id}`);
}

export async function deleteTemplateAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const template = await getTemplate(id);
  const file = await readSchedule();
  const map = templatesById(await listTemplates());
  file.sessions = file.sessions.map((session) => {
    if (session.templateId !== id) return session;
    if (session.bodySnapshot !== null) {
      return { ...session, templateId: null };
    }
    const resolved = resolveSession(session, map);
    return {
      ...session,
      bodySnapshot: resolved.body || template?.body || "",
      templateId: null,
    };
  });
  await writeSchedule(file);
  await deleteTemplateFile(id);
  revalidateAll();
  redirect("/library");
}

export async function importBackupAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a backup file." };
  }
  const text = await file.text();
  const parsed = parseBackupJson(text);
  if (!parsed.ok) {
    return { error: parsed.error };
  }
  await replaceAllTemplates(parsed.backup.templates);
  await writeSchedule({ sessions: parsed.backup.sessions });
  revalidateAll();
  redirect("/");
}

export async function exportBackupPayload(): Promise<BackupFile> {
  const templates = await listTemplates();
  const { sessions } = await readSchedule();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates,
    sessions,
  };
}
