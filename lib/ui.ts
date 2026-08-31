import type { SessionType } from "@/lib/domain";

export const TYPE_SHORT: Record<SessionType, string> = {
  running: "Run",
  strength: "Lift",
  mobility: "Mobility",
  other: "Other",
};

export const TYPE_BAR: Record<SessionType, string> = {
  running: "border-l-sky-600",
  strength: "border-l-amber-600",
  mobility: "border-l-emerald-600",
  other: "border-l-stone-500",
};

export const TYPE_TINT: Record<SessionType, string> = {
  running: "bg-sky-50",
  strength: "bg-amber-50",
  mobility: "bg-emerald-50",
  other: "bg-stone-50",
};

export const fieldClass =
  "mt-1 w-full min-h-10 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

export const btnPrimary =
  "inline-flex min-h-10 items-center justify-center rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

export const btnSecondary =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

export const btnDanger =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2";
