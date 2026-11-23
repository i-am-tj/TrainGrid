"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { ONBOARDING_DISMISSED_COOKIE } from "./model";

/** Hides Home's first-session invitation on this device, for a year. */
export async function hideFirstSessionInviteAction(): Promise<void> {
  await requireMember();
  const jar = await cookies();
  const https = (await headers()).get("x-forwarded-proto") === "https";
  jar.set(ONBOARDING_DISMISSED_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: https,
  });
  revalidatePath("/home");
}
