"use client";

import { createContext, use, useState } from "react";
import { btnSecondary } from "@/lib/ui";

/**
 * On phones the equipment and type filters fold behind one Filters button, so
 * the first routine is higher on the screen (PRODUCT_AUDIT F15). Search and
 * the view control stay visible. From the sm breakpoint up the filters are
 * always shown and the button is hidden.
 *
 * The wrapper sits outside the filters' query key, so the open state survives
 * the navigation each filter makes: picking a type keeps the panel open.
 * The panels opt in with `hidden group-data-[filters-open]/filters:block sm:block`.
 */

const FiltersContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });

export function FiltersDisclosure({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <FiltersContext value={{ open, toggle: () => setOpen((value) => !value) }}>
      <div className="group/filters" data-filters-open={open ? "" : undefined}>
        {children}
      </div>
    </FiltersContext>
  );
}

export function FiltersToggle({ active, controls, className = "" }: { active: number; controls: string; className?: string }) {
  const { open, toggle } = use(FiltersContext);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-controls={controls}
      className={`${btnSecondary} gap-2 sm:hidden ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 5.5h14M5.5 10h9M8 14.5h4" />
      </svg>
      Filters
      {active > 0 ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-stone-900 px-1.5 text-xs font-semibold leading-5 text-white">
          {active}
          <span className="sr-only"> active</span>
        </span>
      ) : null}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 8l5 5 5-5" />
      </svg>
    </button>
  );
}
