/** Says, in text, whether a routine is shared or the member's own (E2-01). */
export function SourceLabel({ isOwn }: { isOwn: boolean }) {
  return isOwn ? (
    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
      Mine
    </span>
  ) : (
    <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
      TrainGrid
    </span>
  );
}
