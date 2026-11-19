import { z } from "zod";

/**
 * Invite requests from the sign-in page: what a visitor may send, what they
 * are told, and the owner's email copy. Pure (the key and clock are
 * parameters); the database (request_invite()) enforces the limits again.
 */

export const INVITE_NAME_MAX = 80;
export const INVITE_NOTE_MAX = 500;

export type InviteRequestInput = { email: string; name: string | null; note: string | null };

export type InviteRequestState =
  | null
  | { status: "sent"; email: string }
  | { status: "invalid"; field: "email" | "name" | "note"; message: string }
  | { status: "error"; message: string };

/** What request_invite() returns. */
export type InviteRequestOutcome = "created" | "received" | "invalid" | "rate_limited" | "paused";

const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value === "" ? null : value));

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your email address.")
    .max(320, "That email address is too long.")
    .pipe(z.email("Enter a valid email address, like you@example.com.")),
  name: optionalText(INVITE_NAME_MAX, `Keep your name under ${INVITE_NAME_MAX} characters.`),
  note: optionalText(INVITE_NOTE_MAX, `Keep the note under ${INVITE_NOTE_MAX} characters.`),
});

export function parseInviteRequest(fields: {
  email: unknown;
  name: unknown;
  note: unknown;
}):
  | { ok: true; value: InviteRequestInput }
  | { ok: false; state: Extract<InviteRequestState, { status: "invalid" }> } {
  const parsed = schema.safeParse({
    email: typeof fields.email === "string" ? fields.email : "",
    name: typeof fields.name === "string" ? fields.name : "",
    note: typeof fields.note === "string" ? fields.note : "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const field = issue.path[0] === "name" ? "name" : issue.path[0] === "note" ? "note" : "email";
    return { ok: false, state: { status: "invalid", field, message: issue.message } };
  }
  return { ok: true, value: parsed.data };
}

/** The visitor's answer for each database outcome. "created" and "received" read the same. */
export function stateForOutcome(outcome: InviteRequestOutcome, email: string): NonNullable<InviteRequestState> {
  switch (outcome) {
    case "created":
    case "received":
      return { status: "sent", email };
    case "invalid":
      return { status: "invalid", field: "email", message: "Enter a valid email address, like you@example.com." };
    case "rate_limited":
      return {
        status: "error",
        message: "A few requests have already come from here. Please try again in an hour.",
      };
    case "paused":
      return {
        status: "error",
        message: "Requests are paused for today while the current ones are reviewed. Please try again tomorrow.",
      };
  }
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** The owner's copy of a request. Plain and HTML, both escaped. */
export function inviteRequestEmail(
  input: InviteRequestInput,
  reviewUrl: string | null,
): { subject: string; text: string; html: string } {
  const who = input.name ? `${input.name} <${input.email}>` : input.email;
  const subject = `TrainGrid invite request · ${input.name ?? input.email}`.slice(0, 200);
  const text = [
    `${who} asked for an invitation to TrainGrid.`,
    input.note ? `\n${input.note}\n` : "",
    reviewUrl
      ? `Review it on the Invitations page: ${reviewUrl}`
      : "Review it on the Invitations page in TrainGrid.",
    "Reply to this email to answer them directly.",
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<!doctype html><html lang="en"><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917;line-height:1.6;max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9a4e24">TrainGrid · invite request</p>
<p style="margin:0 0 16px;font-size:16px"><strong>${escapeHtml(input.name ?? input.email)}</strong>${input.name ? ` &lt;${escapeHtml(input.email)}&gt;` : ""} asked for an invitation.</p>
${input.note ? `<div style="white-space:pre-wrap;border-left:3px solid #9a4e24;padding:4px 0 4px 16px;font-size:15px;margin:0 0 20px">${escapeHtml(input.note)}</div>` : ""}
${reviewUrl ? `<p style="margin:0 0 8px"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-size:14px">Review on the Invitations page</a></p>` : ""}
<p style="margin:16px 0 0;font-size:13px;color:#57534e">Reply to this email to answer them directly.</p>
</body></html>`;
  return { subject, text, html };
}
