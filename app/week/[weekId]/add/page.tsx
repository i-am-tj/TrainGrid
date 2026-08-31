import { notFound, redirect } from "next/navigation";
import { AddSessionForm } from "@/components/session/AddSessionForm";
import type { IsoDay } from "@/lib/domain";
import { listTemplates } from "@/lib/templates";
import { isValidWeekId, todayParts } from "@/lib/week";

export default async function AddSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekId: string }>;
  searchParams: Promise<{
    day?: string;
    time?: string;
    template?: string;
    untimed?: string;
  }>;
}) {
  const { weekId: rawWeekId } = await params;
  const query = await searchParams;
  const today = todayParts();

  if (rawWeekId === "current") {
    const q = new URLSearchParams();
    if (query.day) q.set("day", query.day);
    if (query.time) q.set("time", query.time);
    if (query.template) q.set("template", query.template);
    if (query.untimed) q.set("untimed", query.untimed);
    const suffix = q.toString() ? `?${q}` : "";
    redirect(`/week/${today.weekId}/add${suffix}`);
  }
  if (!isValidWeekId(rawWeekId)) notFound();

  const templates = await listTemplates();
  const dayNum = Number(query.day);
  const day: IsoDay =
    dayNum >= 1 && dayNum <= 7
      ? (dayNum as IsoDay)
      : rawWeekId === today.weekId
        ? today.day
        : 1;
  const time =
    query.time && /^\d{2}:\d{2}$/.test(query.time) ? query.time : null;
  const untimed = query.untimed === "1" || query.untimed === "true";

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Add session</h1>
      <p className="mt-1 text-sm text-stone-600">
        Place a template or a one-off session on this week.
      </p>
      <div className="mt-6">
        <AddSessionForm
          weekId={rawWeekId}
          templates={templates}
          initialDay={day}
          initialTime={untimed ? null : time ?? "07:00"}
          initialTemplateId={query.template ?? null}
        />
      </div>
    </div>
  );
}
