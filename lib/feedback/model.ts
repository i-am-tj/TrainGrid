import { z } from "zod";

/**
 * Member feedback: what a member may send and how it is described. Pure; the
 * database (supabase/migrations/20261118000000_member_feedback.sql) enforces
 * the same limits again.
 */

export const FEEDBACK_KINDS = ["idea", "problem", "praise"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_MAX_LENGTH = 2000;

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, { label: string; hint: string; placeholder: string }> = {
  idea: {
    label: "Idea",
    hint: "Something that would make TrainGrid better",
    placeholder: "It would be great if…",
  },
  problem: {
    label: "Problem",
    hint: "Something broken, confusing or slow",
    placeholder: "What happened, and what did you expect?",
  },
  praise: {
    label: "Praise",
    hint: "Something you enjoy",
    placeholder: "What’s working well for you?",
  },
};

export type FeedbackInput = { kind: FeedbackKind; message: string; pagePath: string | null };

export type FeedbackState =
  | null
  | { status: "sent" }
  | { status: "invalid"; message: string; field: "kind" | "message" }
  | { status: "error"; message: string };

const schema = z.object({
  kind: z.enum(FEEDBACK_KINDS, { error: "Choose what kind of feedback this is." }),
  message: z
    .string()
    .trim()
    .min(1, "Write a few words first.")
    .max(FEEDBACK_MAX_LENGTH, `Keep it under ${FEEDBACK_MAX_LENGTH.toLocaleString("en-GB")} characters.`),
});

/** A local path only, without its query (which could carry search terms). */
export function safePagePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 200) return null;
  return /^[\w\-./~%]+$/.test(path) ? path : null;
}

export function parseFeedback(fields: {
  kind: unknown;
  message: unknown;
  pagePath: unknown;
}): { ok: true; value: FeedbackInput } | { ok: false; state: Extract<FeedbackState, { status: "invalid" }> } {
  const parsed = schema.safeParse({ kind: fields.kind, message: fields.message });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const field = issue.path[0] === "kind" ? "kind" : "message";
    return { ok: false, state: { status: "invalid", field, message: issue.message } };
  }
  return { ok: true, value: { ...parsed.data, pagePath: safePagePath(fields.pagePath) } };
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** The owner's copy of one piece of feedback. Plain and HTML, both escaped. */
export function feedbackEmail({
  input,
  memberName,
  memberEmail,
}: {
  input: FeedbackInput;
  memberName: string | null;
  memberEmail: string | null;
}): { subject: string; text: string; html: string } {
  const { label } = FEEDBACK_KIND_LABELS[input.kind];
  const who = memberName ?? memberEmail ?? "A member";
  const subject = `TrainGrid feedback · ${label} from ${who}`.slice(0, 200);
  const lines = [
    `${label} from ${who}${memberEmail && memberName ? ` <${memberEmail}>` : ""}`,
    input.pagePath ? `Sent from ${input.pagePath}` : null,
    "",
    input.message,
  ].filter((line) => line !== null);
  const html = `<!doctype html><html lang="en"><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;line-height:1.6;max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9a4e24">TrainGrid feedback · ${escapeHtml(label)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#57534e">From ${escapeHtml(who)}${memberEmail && memberName ? ` &lt;${escapeHtml(memberEmail)}&gt;` : ""}${input.pagePath ? ` · on ${escapeHtml(input.pagePath)}` : ""}</p>
<div style="white-space:pre-wrap;border-left:3px solid #9a4e24;padding:4px 0 4px 16px;font-size:15px">${escapeHtml(input.message)}</div>
</body></html>`;
  return { subject, text: lines.join("\n"), html };
}
