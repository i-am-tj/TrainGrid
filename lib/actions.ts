"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dateOfWeekDay, isRealWeekId } from "@/lib/calendar-date";
import { DataError } from "@/lib/data/model";
import { deletePersonalRoutine, savePersonalRoutine } from "@/lib/data/routines";
import type { WorkoutItemInput } from "@/lib/data/schemas";
import { memberData } from "@/lib/data/server";
import {
  createAdhocSession,
  deleteSession,
  duplicateWeek,
  replaceSessionItems,
  scheduleRoutine,
  updateSessionDetails,
} from "@/lib/data/sessions";
import type { IsoDay, SessionType } from "@/lib/domain";

/**
 * Every planner and library mutation.
 *
 * Each action starts from memberData(): the verified member's own client
 * and user id. Nothing here reads an owner, user id or scope from the form.
 * The data layer validates every value with Zod, narrows every query to the
 * member, and Row Level Security enforces the same again in the database.
 */

function revalidateAll() {
  revalidatePath("/", "layout");
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** "1".."7" → IsoDay. Anything else fails validation as an invalid date. */
function isoDay(form: FormData): IsoDay {
  const n = Number(text(form, "day"));
  if (!Number.isInteger(n) || n < 1 || n > 7) throw new DataError("invalid", "Invalid day");
  return n as IsoDay;
}

function dateFromForm(form: FormData): string {
  const weekId = text(form, "weekId");
  if (!isRealWeekId(weekId)) throw new DataError("invalid", "Invalid week");
  return dateOfWeekDay(weekId, isoDay(form));
}

/**
 * The category exactly as submitted. Typed for the call only: the data
 * layer's Zod schema rejects anything that is not a real category.
 */
function category(form: FormData): SessionType {
  return text(form, "type") as SessionType;
}

function startTime(form: FormData): string | null {
  const untimed = text(form, "untimed");
  if (untimed === "on" || untimed === "true") return null;
  return text(form, "time").trim() || null;
}

function duration(form: FormData): number | null {
  const raw = text(form, "durationMinutes").trim();
  return raw ? Number(raw) : null;
}

/**
 * Reads the structured item editor. Rows that are entirely empty are
 * skipped (the editor always shows one row); a row with details but no name
 * is kept so validation can reject it.
 */
function itemsFromForm(form: FormData): WorkoutItemInput[] {
  const field = (name: string) => form.getAll(name).map((v) => (typeof v === "string" ? v : ""));
  const ids = field("itemId");
  const names = field("itemName");
  const instructions = field("itemInstruction");
  const rests = field("itemRest");
  const targets = field("itemTarget");
  const notes = field("itemNotes");
  const equipment = field("itemEquipment");
  const videos = field("itemVideo");

  const items: WorkoutItemInput[] = [];
  names.forEach((name, i) => {
    const row = {
      name,
      instruction: instructions[i] ?? "",
      rest: rests[i] ?? "",
      target: targets[i] ?? "",
      notes: notes[i] ?? "",
      equipment: (equipment[i] ?? "").split(",").filter(Boolean),
      videoUrl: videos[i] ?? "",
    };
    const empty =
      !row.name.trim() &&
      ![row.instruction, row.rest, row.target, row.notes, row.videoUrl].some((v) => v.trim()) &&
      row.equipment.length === 0;
    if (empty) return;
    const id = ids[i]?.trim();
    items.push({
      ...(id ? { id } : {}),
      ...row,
      equipment: row.equipment as WorkoutItemInput["equipment"],
    });
  });
  return items;
}

// ---------------------------------------------------------------------------
// Scheduled sessions
// ---------------------------------------------------------------------------

export async function createScheduledSession(formData: FormData) {
  const { db, userId } = await memberData();
  const date = dateFromForm(formData);
  const common = {
    date,
    startTime: startTime(formData),
    durationMinutes: duration(formData),
    notes: text(formData, "notes"),
  };

  const session =
    text(formData, "from") === "routine"
      ? await scheduleRoutine(db, userId, {
          ...common,
          routineId: text(formData, "routineId"),
          name: text(formData, "name").trim() || undefined,
        })
      : await createAdhocSession(db, userId, {
          ...common,
          name: text(formData, "name"),
          category: category(formData),
          items: itemsFromForm(formData),
        });

  revalidateAll();
  redirect(`/week/${session.weekId}?day=${session.day}`);
}

export async function updateScheduledSession(formData: FormData) {
  const { db, userId } = await memberData();
  const id = text(formData, "id");
  const session = await updateSessionDetails(db, userId, id, {
    name: text(formData, "name"),
    category: category(formData),
    date: dateFromForm(formData),
    startTime: startTime(formData),
    durationMinutes: duration(formData),
    notes: text(formData, "notes"),
  });
  revalidateAll();
  redirect(`/session/${session.id}`);
}

/** Edits the workout of this one occurrence. Its routine is not touched. */
export async function customizeScheduledSession(formData: FormData) {
  const { db, userId } = await memberData();
  const session = await replaceSessionItems(db, userId, text(formData, "id"), itemsFromForm(formData));
  revalidateAll();
  redirect(`/session/${session.id}`);
}

export async function deleteScheduledSessionAction(formData: FormData) {
  const { db, userId } = await memberData();
  await deleteSession(db, userId, text(formData, "id"));
  revalidateAll();
  const weekId = text(formData, "weekId");
  const day = text(formData, "day");
  redirect(isRealWeekId(weekId) ? `/week/${weekId}?day=${encodeURIComponent(day)}` : "/");
}

export async function duplicateWeekAction(formData: FormData) {
  const { db, userId } = await memberData();
  const destWeekId = text(formData, "destWeekId");
  await duplicateWeek(db, userId, {
    sourceWeekId: text(formData, "sourceWeekId"),
    destWeekId,
  });
  revalidateAll();
  redirect(`/week/${destWeekId}`);
}

// ---------------------------------------------------------------------------
// Personal routines
// ---------------------------------------------------------------------------

/** Creates or updates one of the member's own routines. GLOBAL ones cannot be saved. */
export async function upsertRoutineAction(formData: FormData) {
  const { db } = await memberData();
  const id = await savePersonalRoutine(db, text(formData, "id") || null, {
    name: text(formData, "name"),
    category: category(formData),
    description: text(formData, "description"),
    items: itemsFromForm(formData),
  });
  revalidateAll();
  redirect(`/library/${id}`);
}

/** Deletes one of the member's own routines. Scheduled sessions keep their copy. */
export async function deleteRoutineAction(formData: FormData) {
  const { db, userId } = await memberData();
  await deletePersonalRoutine(db, userId, text(formData, "id"));
  revalidateAll();
  redirect("/library");
}
