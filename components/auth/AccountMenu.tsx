"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Secondary account actions; native disclosure keeps links keyboard-accessible. */
export function AccountMenu({ inline = false }: { inline?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  useLayoutEffect(() => {
    if (previousPath.current !== pathname && ref.current) ref.current.open = false;
    previousPath.current = pathname;
  }, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <details
      ref={ref}
      className={inline ? "min-w-0" : "relative hidden sm:block"}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && ref.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 [&::-webkit-details-marker]:hidden">
        Account{" "}
        <span aria-hidden="true" className="text-xs">
          ⌄
        </span>
      </summary>
      <nav
        aria-label="Account"
        className={
          inline
            ? "mb-2 ml-3 border-l border-line pl-2"
            : "absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-line bg-card p-2 shadow-sm"
        }
      >
        <a
          href="/api/export"
          className="flex min-h-10 items-center rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          Download my data
        </a>
      </nav>
    </details>
  );
}
