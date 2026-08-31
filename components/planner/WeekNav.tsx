import Link from "next/link";
import { addWeeks, formatWeekLabel } from "@/lib/week";
import { btnSecondary } from "@/lib/ui";
import type { IsoDay } from "@/lib/domain";

export function WeekNav({
  weekId,
  todayWeekId,
  todayDay,
}: {
  weekId: string;
  todayWeekId: string;
  todayDay: IsoDay;
}) {
  const prev = addWeeks(weekId, -1);
  const next = addWeeks(weekId, 1);
  const todayHref = `/week/${todayWeekId}?day=${todayDay}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Link href={`/week/${prev}`} className={btnSecondary} aria-label="Previous week">
          ←
        </Link>
        <h1 className="text-lg font-semibold">{formatWeekLabel(weekId)}</h1>
        <Link href={`/week/${next}`} className={btnSecondary} aria-label="Next week">
          →
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={todayHref} className={btnSecondary}>
          Today
        </Link>
        <Link href={`/week/${weekId}/add`} className={btnSecondary}>
          Add session
        </Link>
      </div>
    </div>
  );
}
