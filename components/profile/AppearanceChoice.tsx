"use client";

import { useEffect, useState } from "react";
import { applyTheme, type Theme } from "@/components/ThemeToggle";

type Choice = Theme | "system";

const CHOICES: Array<{ value: Choice; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Device" },
];

function savedChoice(): Choice {
  try {
    const saved = window.localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light, dark or the device's setting, as a segmented radio group. Shares the
 * header switch's storage and class (ThemeToggle), so the two always agree.
 */
export function AppearanceChoice() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    // Storage is only readable in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(savedChoice());
    const observer = new MutationObserver(() => setChoice(savedChoice()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const choose = (next: Choice) => {
    if (next === "system") {
      applyTheme(systemTheme());
      try {
        window.localStorage.removeItem("theme");
      } catch {
        // Blocked storage: the page still follows the choice until reload.
      }
    } else {
      applyTheme(next);
    }
    setChoice(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="inline-grid grid-cols-3 rounded-full border border-line bg-background p-1"
    >
      {CHOICES.map(({ value, label }) => {
        const checked = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (choice === null && value === "system") ? 0 : -1}
            onClick={() => choose(value)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const index = CHOICES.findIndex((c) => c.value === (choice ?? "system"));
              const next = CHOICES[(index + step + CHOICES.length) % CHOICES.length]!;
              choose(next.value);
              const group = event.currentTarget.parentElement;
              (group?.querySelectorAll<HTMLButtonElement>("[role=radio]")[CHOICES.indexOf(next)])?.focus();
            }}
            className={`ui-control min-h-8 rounded-full px-3.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 motion-reduce:transition-none ${
              checked ? "bg-card text-foreground shadow-sm ring-1 ring-line" : "text-stone-600 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
