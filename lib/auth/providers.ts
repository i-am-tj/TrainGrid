/**
 * OAuth providers offered on the sign-in page.
 *
 * Only providers that are configured in Supabase belong here. Deferred
 * providers (Apple, ChatGPT) are intentionally absent: no placeholder buttons.
 */
export const OAUTH_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]["id"];

export function isOAuthProviderId(value: unknown): value is OAuthProviderId {
  return OAUTH_PROVIDERS.some((provider) => provider.id === value);
}

/**
 * Messages for the `error` query parameter on /login. Deliberately generic:
 * they never reveal why a sign-in was refused.
 */
const LOGIN_ERRORS: Record<string, string> = {
  signin: "Sign-in could not be completed. Please try again.",
};

export function loginErrorMessage(code: unknown): string | null {
  if (typeof code !== "string" || !code) return null;
  return LOGIN_ERRORS[code] ?? LOGIN_ERRORS.signin!;
}
