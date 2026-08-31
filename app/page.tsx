import { redirect } from "next/navigation";
import { todayParts } from "@/lib/week";

export default function HomePage() {
  const today = todayParts();
  redirect(`/week/${today.weekId}?day=${today.day}`);
}
