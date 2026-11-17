/**
 * Sends one email through Resend's HTTP API (POST /emails).
 *
 * No SDK: one fetch, with a timeout and an idempotency key, so a retried
 * request for the same attempt cannot send twice. The provider's response
 * body is never returned or stored; failures are reduced to a fixed set of
 * codes (they match the database constraint on invitation_email_deliveries).
 *
 * Pure apart from the injected fetch, so it is unit-testable.
 */

import type { EmailConfig } from "./config";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Same key → the provider sends at most once. */
  idempotencyKey: string;
};

export type SendFailureCode =
  | "provider_auth"
  | "provider_rejected"
  | "rate_limited"
  | "provider_unavailable"
  | "timeout";

export type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; code: SendFailureCode; status: number | null };

export type EmailTransport = (email: OutgoingEmail) => Promise<SendResult>;

export const SEND_TIMEOUT_MS = 10_000;

export function classifyStatus(status: number): SendFailureCode {
  if (status === 401 || status === 403) return "provider_auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_rejected";
}

export function createResendTransport(
  config: EmailConfig,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = SEND_TIMEOUT_MS,
): EmailTransport {
  return async (email) => {
    let response: Response;
    try {
      response = await fetchImpl(`${config.apiUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": email.idempotencyKey,
        },
        body: JSON.stringify({
          from: config.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      return {
        ok: false,
        code: name === "TimeoutError" || name === "AbortError" ? "timeout" : "provider_unavailable",
        status: null,
      };
    }

    if (!response.ok) {
      return { ok: false, code: classifyStatus(response.status), status: response.status };
    }
    let messageId: string | null = null;
    try {
      const body = (await response.json()) as { id?: unknown };
      if (typeof body.id === "string" && body.id.length > 0 && body.id.length <= 200) {
        messageId = body.id;
      }
    } catch {
      // Accepted without a readable id: still accepted.
    }
    return { ok: true, messageId };
  };
}
