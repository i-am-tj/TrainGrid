import type {
  ResolvedSession,
  ScheduledSession,
  SessionTemplate,
} from "./domain";

export function templatesById(
  templates: SessionTemplate[],
): Map<string, SessionTemplate> {
  return new Map(templates.map((t) => [t.id, t]));
}

export function resolveSession(
  session: ScheduledSession,
  templates: Map<string, SessionTemplate>,
): ResolvedSession {
  if (session.bodySnapshot !== null) {
    return {
      ...session,
      body: session.bodySnapshot,
      source: session.templateId ? "snapshot" : "adhoc",
    };
  }
  if (session.templateId) {
    const template = templates.get(session.templateId);
    return {
      ...session,
      body: template?.body ?? "",
      source: "template",
    };
  }
  return {
    ...session,
    body: "",
    source: "adhoc",
  };
}

export function resolveSessions(
  sessions: ScheduledSession[],
  templates: SessionTemplate[],
): ResolvedSession[] {
  const map = templatesById(templates);
  return sessions.map((s) => resolveSession(s, map));
}
