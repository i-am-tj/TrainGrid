import type { LoginErrorCode } from "@/lib/auth/providers";

/** What `public.accept_invitation()` can return. */
export type InviteResult = "member" | "not_invited" | "unverified_email";

const INVITE_RESULTS: readonly InviteResult[] = ["member", "not_invited", "unverified_email"];

export function parseInviteResult(value: unknown): InviteResult | null {
  return INVITE_RESULTS.includes(value as InviteResult) ? (value as InviteResult) : null;
}

/**
 * The login error to show for an invitation check, or null when the user is
 * a member and may continue.
 *
 * Anything unexpected is treated as a refusal: access is only ever granted on
 * an explicit "member".
 */
export function loginErrorForInvite(value: unknown): LoginErrorCode | null {
  switch (parseInviteResult(value)) {
    case "member":
      return null;
    case "not_invited":
      return "invite";
    case "unverified_email":
      return "email";
    default:
      return "signin";
  }
}
