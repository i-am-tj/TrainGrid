import "server-only";

import { requireMember } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Db } from "./model";

/**
 * The only way pages and server actions should reach the data layer.
 *
 * It establishes who is asking from the verified session (redirecting
 * anyone who is not a member) and returns a client that runs as that user,
 * so Row Level Security applies to every query. The data functions never
 * see a user id that came from the request.
 */
export async function memberData(): Promise<{ db: Db; userId: string }> {
  const member = await requireMember();
  const db = await createSupabaseServerClient();
  return { db, userId: member.userId };
}
