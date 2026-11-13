"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

/**
 * Phone navigation: a menu button that opens the header links as a vertical
 * list under the header. Built on <details>, so it opens without JavaScript;
 * with JavaScript it also closes after navigating, on Escape (focus returns to
 * the button) and on a click outside. Hidden from `md` up, where the inline
 * nav is shown instead.
 */
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);

  // Close once a navigation lands (the header stays mounted across pages).
  // Pathname only: no Suspense boundary needed, and link clicks inside the
  // panel close it anyway.
  const location = usePathname();
  const [seen, setSeen] = useState(location);
  if (seen !== location) {
    setSeen(location);
    setOpen(false);
  }

  // The <details> element is the source of truth: it opens natively, and React
  // only hears about it from the (asynchronous) toggle event. So close the
  // element itself; its toggle event then brings the state along. Setting the
  // state alone could be a no-op before that event arrives, leaving the menu
  // open. The listeners stay attached and check the element at event time.
  const close = () => {
    if (ref.current) ref.current.open = false;
    setOpen(false);
  };

  useEffect(() => {
    const isOpen = () => ref.current?.open === true;
    const onPointerDown = (event: PointerEvent) => {
      if (isOpen() && !ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isOpen()) return;
      close();
      ref.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // A link that does not change the URL (Export downloads a file) still closes the menu.
  const onPanelClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a")) close();
  };

  return (
    <details
      ref={ref}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="md:hidden"
    >
      <summary
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />}
        </svg>
      </summary>
      <nav
        aria-label="Main"
        onClick={onPanelClick}
        className="absolute inset-x-0 top-full z-30 border-b border-line bg-card px-3 py-2 shadow-sm"
      >
        <ul className="flex flex-col">{children}</ul>
      </nav>
    </details>
  );
}
