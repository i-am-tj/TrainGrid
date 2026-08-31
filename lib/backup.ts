import type { BackupFile, ScheduledSession, SessionTemplate } from "./domain";
import { isSessionType, sanitizeName } from "./domain";
import { coerceSession } from "./schedule";

export type ParseBackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: string };

export function parseBackupJson(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Backup file must be a JSON object." };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    return {
      ok: false,
      error: "Unsupported backup version. Expected version 1.",
    };
  }
  if (!Array.isArray(obj.templates) || !Array.isArray(obj.sessions)) {
    return {
      ok: false,
      error: "Backup must include templates and sessions arrays.",
    };
  }

  const templates: SessionTemplate[] = [];
  for (const item of obj.templates) {
    const template = coerceBackupTemplate(item);
    if (!template) {
      return { ok: false, error: "Backup contains an invalid template." };
    }
    templates.push(template);
  }

  const sessions: ScheduledSession[] = [];
  for (const item of obj.sessions) {
    const session = coerceSession(item);
    if (!session) {
      return {
        ok: false,
        error: "Backup contains an invalid scheduled session.",
      };
    }
    sessions.push(session);
  }

  return {
    ok: true,
    backup: {
      version: 1,
      exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
      templates,
      sessions,
    },
  };
}

function coerceBackupTemplate(raw: unknown): SessionTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id.trim()) return null;
  const name = typeof t.name === "string" ? sanitizeName(t.name) : null;
  if (!name) return null;
  const typeRaw = typeof t.type === "string" ? t.type : "other";
  return {
    id: t.id.trim(),
    name,
    type: isSessionType(typeRaw) ? typeRaw : "other",
    description: typeof t.description === "string" ? t.description : "",
    body: typeof t.body === "string" ? t.body : "",
  };
}
