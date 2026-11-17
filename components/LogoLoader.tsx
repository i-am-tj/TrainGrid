"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * TrainGrid's loader: the logo turning clockwise. Announced politely to screen
 * readers; with reduced motion it stays still while its live label announces progress.
 */

const SIZES = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
} as const;

/** After this long a loader says so, and asks the server once more. */
export const SLOW_AFTER_MS = 5_000;
/** After this long a loader stops waiting quietly and offers a reload. */
export const STUCK_AFTER_MS = 20_000;

export const SLOW_MESSAGE = "This is taking longer than usual. Trying again…";
export const STUCK_MESSAGE = "Still waiting. Check your connection, or reload the page.";

export type LoadPhase = "loading" | "slow" | "stuck";

function phaseAfter(elapsed: number): LoadPhase {
  if (elapsed >= STUCK_AFTER_MS) return "stuck";
  if (elapsed >= SLOW_AFTER_MS) return "slow";
  return "loading";
}

/**
 * Tracks how long something has been loading, for loaders that are rendered
 * on the client (the page loader). `onSlow` runs once, when the slow phase
 * starts (the retry). Timers restart whenever `key` changes.
 */
export function useLoadPhase(onSlow?: () => void, key: unknown = null): LoadPhase {
  const [phase, setPhase] = useState<{ key: unknown; value: LoadPhase }>({ key, value: "loading" });
  const slow = useRef(onSlow);
  useEffect(() => {
    slow.current = onSlow;
  });
  useEffect(() => {
    const start = Date.now();
    let retried = false;
    const update = () => {
      const value = phaseAfter(Date.now() - start);
      setPhase({ key, value });
      if (value !== "loading" && !retried) {
        retried = true;
        slow.current?.();
      }
    };
    const timers = [SLOW_AFTER_MS, STUCK_AFTER_MS].map((at) => window.setTimeout(update, at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [key]);
  return phase.key === key ? phase.value : "loading";
}

export function LogoLoader({
  size = "md",
  label = "Loading…",
  showLabel = false,
  detail,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  showLabel?: boolean;
  /** Extra text announced with the label, e.g. that loading is slow. */
  detail?: string;
}) {
  return (
    <span role="status" aria-live="polite" className="inline-flex flex-col items-center gap-2 text-center">
      <BrandLogo
        className={`${SIZES[size]} rounded-[22%] animate-spin [animation-duration:1.1s] motion-reduce:animate-none dark:outline dark:outline-1 dark:outline-hairline`}
      />
      <span className={showLabel ? "text-sm text-stone-600" : "sr-only"}>{label}</span>
      {detail ? (
        <span data-testid="loader-detail" className="max-w-xs text-xs leading-5 text-stone-600">
          {detail}
        </span>
      ) : null}
    </span>
  );
}

/** The text a client-rendered loader shows for each phase. */
export function slowNotice(phase: LoadPhase): { detail?: string } {
  if (phase === "slow") return { detail: SLOW_MESSAGE };
  if (phase === "stuck") return { detail: STUCK_MESSAGE };
  return {};
}

/**
 * A section-sized loader: holds roughly the section's space while its data
 * arrives. It is often a Suspense fallback streamed from the server, which
 * React leaves non-interactive until the section arrives, so nothing here may
 * depend on JavaScript: the "taking longer than usual" note appears after
 * SLOW_AFTER_MS and the "still waiting" note after STUCK_AFTER_MS through CSS
 * alone (globals.css, .loader-note). The retry itself, and announcing those
 * notes to screen readers, is done by SlowSectionWatcher in the root layout.
 */
export function SectionLoader({ label = "Loading…", minHeight = "min-h-48" }: { label?: string; minHeight?: string }) {
  return (
    <div
      className={`flex ${minHeight} w-full flex-col items-center justify-center gap-3 rounded-lg`}
      data-testid="section-loader"
    >
      <LogoLoader size="md" label={label} showLabel />
      <span aria-hidden="true" className="grid max-w-xs text-center text-xs leading-5 text-stone-600">
        <span className="loader-note loader-note-slow">{SLOW_MESSAGE}</span>
        <span className="loader-note loader-note-stuck">{STUCK_MESSAGE}</span>
      </span>
    </div>
  );
}
