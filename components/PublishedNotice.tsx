import { isPublishedReadonly } from "@/lib/runtime";

export function PublishedNotice({
  emptyWeek = false,
}: {
  emptyWeek?: boolean;
}) {
  const readonly = isPublishedReadonly();
  if (!readonly && !emptyWeek) return null;

  if (readonly) {
    return (
      <aside
        role="note"
        className="mt-3 rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50/60 px-3.5 py-3.5 text-[13px] leading-snug text-stone-700 sm:px-4 sm:py-4 sm:text-sm sm:leading-relaxed"
      >
        <p>
          Thanks for stopping by 👋 You&apos;re peeking at{" "}
          <a
            href="https://github.com/i-am-tj"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-500"
          >
            @i-am-tj
          </a>
          &apos;s workout schedule.
        </p>
        <p className="mt-2.5 sm:mt-2">
          Want one of your own? Clone this repo to your GitHub and deploy it —
          then go fill the week with whatever you&apos;re training for 💪
        </p>
        <p className="mt-2.5 text-stone-500 sm:mt-2">Ciao ✨</p>
      </aside>
    );
  }

  return (
    <aside
      role="note"
      className="mt-3 rounded-2xl border border-line bg-card px-3.5 py-3 text-[13px] leading-snug text-stone-700 sm:px-4 sm:text-sm sm:leading-relaxed"
    >
      <p>
        Nothing on the board this week yet. Add a few sessions here, then push
        when you&apos;re ready to update the live site.
      </p>
    </aside>
  );
}
