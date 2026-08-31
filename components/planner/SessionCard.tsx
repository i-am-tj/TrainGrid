import Link from "next/link";
import type { ResolvedSession } from "@/lib/domain";
import { TYPE_BAR, TYPE_SHORT, TYPE_TINT } from "@/lib/ui";

export function SessionCard({
  session,
  showTime,
}: {
  session: ResolvedSession;
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
      href={`/session/${session.id}`}
      className={`block rounded-sm border border-stone-200 border-l-4 ${TYPE_BAR[session.type]} ${TYPE_TINT[session.type]} px-1.5 py-1 text-left hover:brightness-[0.98]`}
      aria-label={`${session.name}, ${session.time ?? "no time"}`}
    >
      <div className="truncate text-xs font-semibold text-stone-900">
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
