import { redirect } from "next/navigation";
import { todayParts } from "@/lib/week";
import { requireMember } from "@/lib/auth/session";

export default async function HomePage() {
  await requireMember();
  const today = todayParts();
  redirect(`/week/${today.weekId}?day=${today.day}`);
}
