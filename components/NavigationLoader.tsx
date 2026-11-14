"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoLoader } from "@/components/LogoLoader";

/**
 * Page loader for client-side navigations to another page. Shows the spinning
 * TrainGrid logo when a member follows an internal link (or submits a GET
 * form) to a different path, and hides it as soon as the new URL is in place.
 * Changes within the same page (a library search or filter, another day of
 * the planner's week) are covered by that page's section loader instead, so
 * the two never show together.
 *
 * Route-level loading.js files would do this per page, but they make a route
 * stream, after which notFound() and redirect() can no longer set the HTTP
 * status (E2-D16); most TrainGrid pages need those. So this lives once in the
 * root layout instead. It waits 150 ms before appearing, so fast navigations
 * do not flash, and gives up after 15 s in case a navigation never lands.
 */
const SHOW_AFTER_MS = 150;
const GIVE_UP_AFTER_MS = 15_000;

function isInternalNavigation(url: URL): boolean {
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false; // downloads such as the export
  return url.pathname !== window.location.pathname;
}

export function NavigationLoader() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  // A new URL means the navigation landed.
  const location = `${pathname}?${search}`;
  const [seen, setSeen] = useState(location);
  if (seen !== location) {
    setSeen(location);
    setPending(false);
    setVisible(false);
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (isInternalNavigation(new URL(anchor.href, window.location.href))) setPending(true);
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (form.method.toLowerCase() !== "get") return; // server actions show their own pending state
      const url = new URL(form.action || window.location.href, window.location.href);
      url.search = new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString();
      if (isInternalNavigation(url)) setPending(true);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const show = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const giveUp = window.setTimeout(() => {
      setPending(false);
      setVisible(false);
    }, GIVE_UP_AFTER_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(giveUp);
    };
  }, [pending]);

  if (!visible) return null;
  return (
    <div
      data-testid="page-loader"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
    >
      <LogoLoader size="lg" label="Loading page…" />
    </div>
  );
}
