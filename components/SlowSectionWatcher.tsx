"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SLOW_AFTER_MS, SLOW_MESSAGE, STUCK_AFTER_MS, STUCK_MESSAGE } from "@/components/LogoLoader";

/**
 * Retries slow sections. A section loader that is still on screen after
 * SLOW_AFTER_MS asks the server for the page once more (router.refresh(): a
 * GET of the current URL; every section's read is safe to repeat), at most
 * once per URL. It also announces the loader's notes, which are shown by CSS
 * alone, to screen readers, and marks the page as retried (a data attribute
 * on <html>) so a loader that the retry re-renders keeps its note on screen.
 *
 * This lives once in the root layout because a section loader streamed from
 * the server cannot run its own timers: React does not hydrate a Suspense
 * fallback while it waits for that section.
 */
const CHECK_EVERY_MS = 500;
const RETRIED = "data-section-retried";

/** How long a loader has been on screen: its own CSS note timeline, else first sight. */
function loaderAge(loader: Element, firstSeen: WeakMap<Element, number>, now: number): number {
  // A finished CSS animation stops its clock at its end (5 s or 20 s), so the
  // latest-ending one tells the age up to the last threshold that matters.
  const times = (loader.querySelector(".loader-note-slow")?.getAnimations?.() ?? [])
    .map((animation) => animation.currentTime)
    .filter((time): time is number => typeof time === "number");
  if (times.length) return Math.max(...times);
  if (!firstSeen.has(loader)) firstSeen.set(loader, now);
  return now - firstSeen.get(loader)!;
}

export function SlowSectionWatcher() {
  const router = useRouter();
  const location = `${usePathname()}?${useSearchParams().toString()}`;
  const [announcement, setAnnouncement] = useState({ location, text: "" });

  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute(RETRIED);
    const firstSeen = new WeakMap<Element, number>();
    let retriedAt: number | null = null;
    let warnedStuck = false;
    const check = () => {
      const now = Date.now();
      const loaders = document.querySelectorAll("[data-testid=section-loader]");
      if (retriedAt === null) {
        let oldest = -1;
        for (const loader of loaders) oldest = Math.max(oldest, loaderAge(loader, firstSeen, now));
        if (oldest >= SLOW_AFTER_MS) {
          retriedAt = now;
          root.setAttribute(RETRIED, "");
          setAnnouncement({ location, text: SLOW_MESSAGE });
          router.refresh();
        }
      } else if (loaders.length && !warnedStuck && now - retriedAt >= STUCK_AFTER_MS - SLOW_AFTER_MS) {
        warnedStuck = true;
        setAnnouncement({ location, text: STUCK_MESSAGE });
      }
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      window.clearInterval(timer);
      root.removeAttribute(RETRIED);
    };
  }, [location, router]);

  return (
    <p aria-live="polite" className="sr-only" data-testid="slow-section-announcer">
      {announcement.location === location ? announcement.text : ""}
    </p>
  );
}
