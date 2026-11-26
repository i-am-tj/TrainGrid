"use client";

import { useLayoutEffect } from "react";

/**
 * Applies the theme when the inline script in app/layout.tsx could not.
 *
 * When an app page calls notFound(), Next.js answers with a bare error shell
 * and React renders the root layout in the browser, where an inline <script>
 * never runs, so a dark-preference visitor saw a light 404 (UI_DESIGN_AUDIT
 * rank 9). The script always sets `color-scheme`, so its absence means it
 * didn't run. Same rule as the script: the saved choice, else the system
 * setting. Never saves anything.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.style.colorScheme) return;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("theme");
    } catch {
      // Blocked storage: follow the system setting.
    }
    const theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, []);
  return null;
}
