/**
 * OAuth providers offered on the sign-in page.
 *
 * Only providers that are configured in Supabase belong here. Deferred
 * providers (Apple, ChatGPT) are intentionally absent: no placeholder buttons.
 */
export const OAUTH_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]["id"];

export function isOAuthProviderId(value: unknown): value is OAuthProviderId {
  return OAUTH_PROVIDERS.some((provider) => provider.id === value);
}

/**
 * Messages for the `error` query parameter on /login. Only these fixed texts
 * are ever shown; provider error details are never rendered.
 */
export type LoginErrorCode = "signin" | "email" | "invite";

const LOGIN_ERRORS: Record<LoginErrorCode, string> = {
  signin: "Sign-in could not be completed. Please try again.",
  invite:
    "TrainGrid is currently invite-only. Ask the person who invited you to verify the email used for your account.",
  email:
    "We could not get a verified email address from that account. Add and verify a primary email with the provider, or sign in with a different account.",
};

export function loginErrorMessage(code: unknown): string | null {
  if (typeof code !== "string" || !code) return null;
  return Object.hasOwn(LOGIN_ERRORS, code)
    ? LOGIN_ERRORS[code as LoginErrorCode]
    : LOGIN_ERRORS.signin;
}

type ParamReader = { get(name: string): string | null };

/**
 * Maps the error parameters Supabase adds to the callback URL onto one of
 * our fixed codes.
 *
 * A provider account without a usable verified email (possible on GitHub)
 * gets its own explanation, because the person can fix it. Access is never
 * granted without a verified email; everything else stays generic.
 */
export function classifyCallbackError(params: ParamReader): LoginErrorCode {
  const text = [params.get("error_code"), params.get("error_description")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/_/g, " ");
  return /\bemail\b/.test(text) ? "email" : "signin";
}
