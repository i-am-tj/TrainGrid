"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { readEmailConfig, senderOnSameDomain } from "@/lib/email/config";
import { createResendTransport } from "@/lib/email/resend";
import { configuredSiteOrigin } from "@/lib/site";
import { createSupabaseAdminClient, isSecretKeyConfigured } from "@/lib/supabase/admin";
import { clientIp, networkHash } from "./network";
import {
  inviteRequestEmail,
  parseInviteRequest,
  stateForOutcome,
  type InviteRequestInput,
  type InviteRequestOutcome,
  type InviteRequestState,
} from "./model";

const OUTCOMES = new Set<InviteRequestOutcome>(["created", "received", "invalid", "rate_limited", "paused"]);
const UNAVAILABLE: InviteRequestState = {
  status: "error",
  message: "Your request couldn’t be sent just now. Please try again in a moment.",
};

/**
 * A visitor asks for an invitation from the sign-in page. Public: no session.
 *
 * The secret key is used for exactly one call, request_invite(), which
 * validates the input and enforces the limits (one pending request per
 * address, three per network per hour, 50 a day) and is not reachable through
 * the API. The visitor is told the same thing whether the request is new,
 * already pending, or the address is already invited. The owner is emailed
 * only for a new request.
 */
export async function requestInviteAction(_previous: InviteRequestState, form: FormData): Promise<InviteRequestState> {
  const parsed = parseInviteRequest({
    email: form.get("email"),
    name: form.get("name"),
    note: form.get("note"),
  });
  if (!parsed.ok) return parsed.state;

  // Honeypot: a field people never see. Bots that fill it get a quiet "sent".
  const trap = form.get("company");
  if (typeof trap === "string" && trap.trim() !== "") return { status: "sent", email: parsed.value.email };

  if (!isSecretKeyConfigured()) return UNAVAILABLE;

  const head = await headers();
  const ipHash = networkHash(
    clientIp(head.get("x-forwarded-for"), head.get("x-real-ip")),
    process.env.SUPABASE_SECRET_KEY?.trim() ?? "",
  );

  const { data, error } = await createSupabaseAdminClient().rpc("request_invite", {
    p_email: parsed.value.email,
    p_name: parsed.value.name ?? undefined,
    p_note: parsed.value.note ?? undefined,
    p_ip_hash: ipHash ?? undefined,
  });
  if (error || !OUTCOMES.has(data as InviteRequestOutcome)) {
    console.error("invite request not stored", { code: error?.code });
    return UNAVAILABLE;
  }

  const outcome = data as InviteRequestOutcome;
  if (outcome === "created") await emailOwner(parsed.value);
  return stateForOutcome(outcome, parsed.value.email);
}

/** The Invitations page on the trusted origin (never the request's Host). */
function reviewUrl(): string | null {
  const origin = configuredSiteOrigin();
  return origin ? `${origin}/admin/invitations` : null;
}

/** Best effort: a failed email never turns a stored request into an error. */
async function emailOwner(input: InviteRequestInput) {
  const to = (process.env.TRAINGRID_INVITE_REQUESTS_TO ?? process.env.TRAINGRID_FEEDBACK_TO)?.trim();
  const config = readEmailConfig();
  if (!to || !config || !z.email().safeParse(to).success) return;

  const from = senderOnSameDomain(config.from, "TrainGrid Requests", "requests") ?? undefined;
  const result = await createResendTransport(config)({
    to,
    from,
    ...inviteRequestEmail(input, reviewUrl()),
    idempotencyKey: `traingrid-invite-request/${crypto.randomUUID()}`,
    replyTo: input.email,
  });
  if (!result.ok) console.error("invite request email not sent", { code: result.code });
}
