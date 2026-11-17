import Link from "next/link";
import type { PlannerSession } from "@/lib/domain";
import { TYPE_BAR, TYPE_SHORT, TYPE_TINT } from "@/lib/ui";

export function SessionCard({
  session,
  showTime,
}: {
  session: PlannerSession;
  showTime?: boolean;
}) {
  const timeLabel =
    showTime && session.time
      ? session.time
      : session.time && session.time.endsWith(":30")
        ? session.time
        : null;
  const duration =
    session.durationMinutes != null ? `${session.durationMinutes}m` : null;

  return (
    <Link
      prefetch={false}
      href={`/session/${session.id}`}
      className={`ui-control block rounded-md border border-stone-200 border-l-4 ${TYPE_BAR[session.type]} ${TYPE_TINT[session.type]} px-1.5 py-1 text-left hover:brightness-[0.98]`}
      aria-label={`${session.name}, ${session.time ?? "no time"}`}
    >
      <div className="text-xs font-semibold leading-snug text-stone-900 [overflow-wrap:anywhere]">
        {session.name}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-1 text-[10px] text-stone-600">
        {timeLabel ? <span>{timeLabel}</span> : null}
        {duration ? <span>{duration}</span> : null}
        <span>{TYPE_SHORT[session.type]}</span>
      </div>
    </Link>
  );
}
