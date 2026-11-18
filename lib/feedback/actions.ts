"use server";

import { z } from "zod";
import { requireMember } from "@/lib/auth/session";
import { memberData } from "@/lib/data/server";
import { readEmailConfig, senderOnSameDomain } from "@/lib/email/config";
import { createResendTransport } from "@/lib/email/resend";
import { feedbackEmail, parseFeedback, type FeedbackInput, type FeedbackState } from "./model";

/**
 * Saves a member's feedback, then (best effort) emails the owner a copy.
 *
 * The row is written as the member, so Row Level Security decides: only an
 * active member, only their own row, at most 10 in 24 hours. The email goes
 * to TRAINGRID_FEEDBACK_TO when that and the email settings are present; a
 * failed email never turns a saved message into an error for the member.
 */
export async function sendFeedbackAction(_previous: FeedbackState, form: FormData): Promise<FeedbackState> {
  const member = await requireMember();
  const parsed = parseFeedback({
    kind: form.get("kind"),
    message: form.get("message"),
    pagePath: form.get("page_path"),
  });
  if (!parsed.ok) return parsed.state;

  const { db } = await memberData();
  const { error } = await db.from("member_feedback").insert({
    kind: parsed.value.kind,
    message: parsed.value.message,
    page_path: parsed.value.pagePath,
  });
  if (error) {
    if (error.message.includes("feedback_rate_limited")) {
      return {
        status: "error",
        message: "That’s a lot of feedback today. Thank you! Please send more tomorrow.",
      };
    }
    console.error("feedback not saved", { code: error.code });
    return { status: "error", message: "Your feedback couldn’t be sent just now. Please try again." };
  }

  await emailOwner(parsed.value, member.displayName, member.email);
  return { status: "sent" };
}

async function emailOwner(input: FeedbackInput, memberName: string | null, memberEmail: string | null) {
  const to = process.env.TRAINGRID_FEEDBACK_TO?.trim();
  const config = readEmailConfig();
  if (!to || !config || !z.email().safeParse(to).success) return;

  const replyTo = memberEmail && z.email().safeParse(memberEmail).success ? memberEmail : undefined;
  // Arrives as "TrainGrid Feedback", not as the invitation sender.
  const from = senderOnSameDomain(config.from, "TrainGrid Feedback", "feedback") ?? undefined;
  const result = await createResendTransport(config)({
    to,
    from,
    ...feedbackEmail({ input, memberName, memberEmail }),
    idempotencyKey: `traingrid-feedback/${crypto.randomUUID()}`,
    replyTo,
  });
  if (!result.ok) console.error("feedback email not sent", { code: result.code });
}
