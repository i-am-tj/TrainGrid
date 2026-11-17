import type { SessionType } from "@/lib/domain";

export const TYPE_SHORT: Record<SessionType, string> = {
  running: "Run",
  strength: "Lift",
  plyometrics: "Plyo",
  other: "Other",
};

export const TYPE_BAR: Record<SessionType, string> = {
  running: "border-l-sky-600",
  strength: "border-l-amber-600",
  plyometrics: "border-l-emerald-600",
  other: "border-l-stone-500",
};

export const TYPE_TINT: Record<SessionType, string> = {
  running: "bg-sky-50",
  strength: "bg-amber-50",
  plyometrics: "bg-emerald-50",
  other: "bg-stone-50",
};

export const fieldClass =
  "ui-control mt-1 w-full min-h-10 rounded-md border border-stone-500 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-500 shadow-sm focus:border-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

export const btnPrimary =
  "ui-control inline-flex min-h-10 items-center justify-center rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

export const btnSecondary =
  "ui-control inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

export const btnDanger =
  "ui-control inline-flex min-h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2";

/** Presentation-only variants; use anchors for navigation and buttons for actions. */
export const btnOutline = btnSecondary;
export const btnGhost =
  "ui-control inline-flex min-h-10 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100";
export const iconButton =
  "ui-control inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-line text-stone-700 hover:bg-stone-100";
export const textLink = "rounded-sm text-accent underline underline-offset-4 hover:text-foreground";
