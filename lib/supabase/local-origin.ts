/** Only HTTP origins for the local CLI, including its configurable port. */
export function isLocalSupabaseOrigin(value: string): boolean {
  if (!/^http:\/\/(?:localhost|127\.0\.0\.1):\d{1,5}\/?$/.test(value)) return false;
  return URL.canParse(value);
}
