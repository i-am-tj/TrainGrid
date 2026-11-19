"use client";

import { useEffect } from "react";
import Lenis, { type VirtualScrollData } from "lenis";
import "lenis/dist/lenis.css";

// Measure on each gesture so rotation, zoom and font loading move the stops with the page.
function sectionStops() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(".landing > section"));
  const limit = document.documentElement.scrollHeight - window.innerHeight;
  const steps = document.querySelector("#how-it-works > .ui-eyebrow");
  const card = document.querySelector(".creator-card");
  const founderFitsWithSteps = steps && card &&
    card.getBoundingClientRect().bottom - steps.getBoundingClientRect().top + 32 <= window.innerHeight;
  const stops = [0];
  for (const section of sections.slice(1)) {
    if (section.id === "about" && founderFitsWithSteps) continue;
    const top = section.id === "how-it-works" && founderFitsWithSteps
      ? steps.getBoundingClientRect().top - 16
      : section.getBoundingClientRect().top;
    stops.push(Math.min(limit, Math.round(window.scrollY + top)));
  }
  return [...stops, limit];
}

export function LandingScroll() {
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scroll: Lenis | undefined;

    let destination: number | undefined;
    let lastWheel = -Infinity;
    let wheelDirection = 0;
    let touch: { x: number; y: number; origin: number; time: number } | undefined;

    function advance(origin: number, direction: number) {
      const stops = sectionStops();
      const next = direction > 0
        ? stops.find(y => y > origin + 2)
        : stops.reverse().find(y => y < origin - 2);
      if (next === undefined) return;
      destination = next;
      scroll?.scrollTo(next, {
        duration: 1.25,
        easing: t => (1 - Math.cos(Math.PI * t)) / 2,
        onComplete: () => { destination = undefined; },
      });
    }

    function onGesture({ event, deltaX, deltaY }: VirtualScrollData) {
      if (event.ctrlKey || event.target instanceof Element &&
          event.target.closest("dialog, [role=dialog], textarea, select")) return false;
      if (event instanceof WheelEvent) {
        if (!deltaY || Math.abs(deltaX) > Math.abs(deltaY) || event.shiftKey) return false;
        event.preventDefault();
        const direction = Math.sign(deltaY);
        // Momentum events belong to the original trackpad gesture.
        if (event.timeStamp - lastWheel > 180 || direction !== wheelDirection) {
          advance(destination ?? window.scrollY, direction);
        }
        wheelDirection = direction;
        lastWheel = event.timeStamp;
        return false;
      }

      if (event.touches.length > 1) {
        touch = undefined;
        return false;
      }
      if (event.type === "touchstart") {
        const point = event.touches[0];
        touch = { x: point.clientX, y: point.clientY, origin: destination ?? window.scrollY, time: event.timeStamp };
        destination = undefined;
      }
      if (!touch) return false;
      if (event.type === "touchend") {
        const point = event.changedTouches[0];
        const distance = touch.y - point.clientY;
        // A swipe pages once. Slow drags allow reading long sections on a phone.
        if (Math.abs(distance) >= 35 && Math.abs(distance) > Math.abs(touch.x - point.clientX)
            && Math.abs(distance) / Math.max(1, event.timeStamp - touch.time) >= 0.18) {
          advance(touch.origin, Math.sign(distance));
          touch = undefined;
          return false;
        }
        touch = undefined;
      }
      return true;
    }

    function syncMotion() {
      scroll?.destroy();
      scroll = undefined;
      destination = undefined;
      touch = undefined;
      lastWheel = -Infinity;
      if (motion.matches) return;
      scroll = new Lenis({
        autoRaf: true,
        lerp: 0.12,
        syncTouch: true,
        stopInertiaOnNavigate: true,
        virtualScroll: onGesture,
      });
    }

    function stopInertiaAtAnchor(event: MouseEvent) {
      if (scroll?.isScrolling === "smooth" && event.target instanceof Element && event.target.closest('a[href^="#"]')) {
        destination = undefined;
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
