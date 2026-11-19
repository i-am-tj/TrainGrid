"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

export function LandingScroll() {
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scroll: Lenis | undefined;

    function syncMotion() {
      scroll?.destroy();
      scroll = undefined;
      if (motion.matches) return;
      scroll = new Lenis({
        autoRaf: true,
        lerp: 0.12,
        syncTouch: true,
        stopInertiaOnNavigate: true,
        // Leave multi-finger gestures, including pinch zoom, to the browser.
        virtualScroll: ({ event }) => !("touches" in event && event.touches.length > 1),
      });
    }

    function stopInertiaAtAnchor(event: MouseEvent) {
      if (scroll?.isScrolling === "smooth" && event.target instanceof Element && event.target.closest('a[href^="#"]')) {
        scroll.stop();
        scroll.start();
      }
    }

    syncMotion();
    document.addEventListener("click", stopInertiaAtAnchor, true);
    motion.addEventListener("change", syncMotion);
    return () => {
      document.removeEventListener("click", stopInertiaAtAnchor, true);
      motion.removeEventListener("change", syncMotion);
      scroll?.destroy();
    };
  }, []);

  return null;
}
