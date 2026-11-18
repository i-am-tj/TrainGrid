/**
 * What the profile page shows about the member, prepared without Next.js or
 * the database so it can be tested on its own.
 */

/** Up to two letters for the avatar: "Ada Lovelace" → "AL", "ada@x.dev" → "A". */
export function initialsFor(displayName: string | null, email: string | null): string {
  const words = (displayName ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => /\p{L}|\p{N}/u.test(word));
  if (words.length > 0) {
    const first = Array.from(words[0]!)[0] ?? "";
    const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? "") : "";
    return (first + last).toLocaleUpperCase("en-AU");
  }
  const fromEmail = Array.from((email ?? "").trim())[0];
  return fromEmail ? fromEmail.toLocaleUpperCase("en-AU") : "?";
}

/** The name to greet with: the display name, else the email's local part, else "Member". */
export function profileName(displayName: string | null, email: string | null): string {
  const name = displayName?.trim();
  if (name) return name;
  const local = email?.split("@")[0]?.trim();
  return local || "Member";
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

/** "November 2026" from a timestamp; null when it cannot be read. */
export function memberSince(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const time = Date.parse(createdAt);
  return Number.isNaN(time) ? null : MONTH_YEAR.format(new Date(time));
}

/** "1 session", "3 sessions". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-AU")} ${count === 1 ? one : many}`;
}

/** "Australia/Sydney" → "Australia / Sydney", "America/Argentina/Salta" → "America / Argentina / Salta". */
export function timeZoneLabel(timeZone: string): string {
  return timeZone.replaceAll("_", " ").split("/").join(" / ");
}
