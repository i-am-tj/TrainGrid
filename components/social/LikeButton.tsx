"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLikeAction } from "@/lib/social/actions";
import { countLabel } from "@/lib/social/model";

/**
 * Like or unlike a post. The heart and count change at once (optimistic);
 * if the server refuses, they go back and the reason is shown. A toggle
 * button (aria-pressed), so screen readers hear "Like, pressed".
 */
export function LikeButton({
  postId,
  liked,
  count,
  canLike,
}: {
  postId: string;
  liked: boolean;
  count: number;
  /** False for members without a social profile: they see the count only. */
  canLike: boolean;
}) {
  const [state, setOptimistic] = useOptimistic({ liked, count });
  const [problem, setProblem] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !state.liked;
    setProblem(null);
    startTransition(async () => {
      setOptimistic({ liked: next, count: Math.max(0, state.count + (next ? 1 : -1)) });
      const result = await setLikeAction(postId, next).catch(() => ({ status: "error" as const, message: "Couldn’t update your like. Try again." }));
      if (result.status === "error") setProblem(result.message);
    });
  }

  const label = countLabel(state.count, "like");
  if (!canLike) {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 px-1 text-sm text-stone-600" data-testid="like-count">
        <Heart filled={false} />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={state.liked}
        aria-label={`Like. ${label}`}
        data-testid="like-button"
        className={`ui-control inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
          state.liked ? "text-accent hover:bg-accent/10" : "text-stone-700 hover:bg-stone-100"
        }`}
      >
        <Heart filled={state.liked} />
        <span className="tabular-nums" aria-hidden="true">
          {state.count.toLocaleString("en-AU")}
        </span>
      </button>
      {problem ? (
        <span role="alert" className="mt-1 text-xs text-red-800">
          {problem}
        </span>
      ) : null}
    </span>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`size-4 transition-transform duration-150 motion-reduce:transition-none ${filled ? "scale-110" : ""}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    >
      <path d="M10 16.5s-6-3.6-6-8.1A3.4 3.4 0 0 1 10 6.1a3.4 3.4 0 0 1 6 2.3c0 4.5-6 8.1-6 8.1z" />
    </svg>
  );
}
