"use client";

import { useEffect, useState } from "react";

/**
 * Light / dark switch, as on iamtj.dev. The theme is a `dark` class on <html>,
 * applied before first paint by the script in app/layout.tsx (saved choice,
 * else the system setting), so this only reads and changes it.
 */

type Theme = "light" | "dark";

export const THEME_COLORS: Record<Theme, string> = { light: "#f4f1ea", dark: "#12100e" };

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // Private mode or blocked storage: the switch still works for this page.
  }
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // The class is only readable in the browser; reading it after hydration
    // keeps the server and client markup equal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(currentTheme());
  }, []);

  if (theme === null) {
    return <span className="inline-flex h-9 w-9 shrink-0" aria-hidden="true" />;
  }

  const isDark = theme === "dark";
  const next: Theme = isDark ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={`Switch to ${next} mode`}
      aria-pressed={isDark}
      title={`Switch to ${next} mode`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-foreground transition-colors duration-300 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 motion-reduce:transition-none"
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
