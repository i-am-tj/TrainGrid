import "server-only";

import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE, resolveTimeZone, todayIn, type MemberToday } from "./time-zone";

/** The viewer's validated IANA time zone (see lib/time-zone.ts). */
export async function getRequestTimeZone(): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(TIME_ZONE_COOKIE)?.value;
  let decoded: string | undefined;
  try {
    decoded = raw ? decodeURIComponent(raw) : undefined;
  } catch {
    decoded = undefined;
  }
  return resolveTimeZone(decoded, process.env.TRAINGRID_DEFAULT_TIME_ZONE);
}

/** Today for the current request, in the member's time zone. */
export async function getRequestToday(now: Date = new Date()): Promise<MemberToday> {
  return todayIn(await getRequestTimeZone(), now);
}
