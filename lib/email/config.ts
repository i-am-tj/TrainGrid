/**
 * Email sending configuration. Pure: the environment is a parameter.
 *
 *   RESEND_API_KEY          secret, server only (starts with "re_")
 *   TRAINGRID_EMAIL_FROM    e.g. "TrainGrid Invites <invites@traingrid.example.com>",
 *                           on a domain verified in Resend
 *   TRAINGRID_EMAIL_REPLY_TO optional reply-to address
 *   RESEND_API_URL          optional; only the real Resend API or a local mock
 *                           (http://127.0.0.1 / localhost) for tests
 *
 * Missing or malformed values mean "not configured": invitations still work,
 * and the admin page says plainly that no email is sent.
 */

import { z } from "zod";

type Env = Record<string, string | undefined>;

export const RESEND_API_URL = "https://api.resend.com";

export type EmailConfig = {
  apiKey: string;
  apiUrl: string;
  from: string;
  replyTo: string | null;
};

const address = z.email().max(320);

/**
 * Parses "Name <addr@domain>" (the space before "<" is optional) or a bare
 * address, and returns it in the canonical "Name <addr>" / "addr" form, or
 * null. The name may not contain <, > or quotes.
 */
export function normalizeFromAddress(value: string): string | null {
  const named = /^([^<>"\r\n]{1,100}?)\s*<([^<>\s]+)>$/.exec(value);
  if (named) {
    const name = named[1]!.trim();
    const addr = named[2]!;
    if (!name || !address.safeParse(addr).success) return null;
    return `${name} <${addr}>`;
  }
  return address.safeParse(value).success ? value : null;
}

export function isValidFromAddress(value: string): boolean {
  return normalizeFromAddress(value) !== null;
}

function apiUrlFrom(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return RESEND_API_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin === RESEND_API_URL) return RESEND_API_URL;
  // A local mock only: never let configuration send mail through another host.
  if (url.protocol === "http:" && /^(127\.0\.0\.1|localhost)$/.test(url.hostname)) {
    return url.origin;
  }
  return null;
}

export function readEmailConfig(env: Env = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = normalizeFromAddress(env.TRAINGRID_EMAIL_FROM?.trim() ?? "");
  const replyTo = env.TRAINGRID_EMAIL_REPLY_TO?.trim() || null;
  const apiUrl = apiUrlFrom(env.RESEND_API_URL);
  if (!apiKey || !from || !apiUrl) return null;
  if (!/^re_[A-Za-z0-9_]+$/.test(apiKey)) return null;
  if (replyTo && !address.safeParse(replyTo).success) return null;
  return { apiKey, apiUrl, from, replyTo };
}
