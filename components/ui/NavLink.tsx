"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  className,
  describedBy,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
  /** Id of extra text read after the link's name (e.g. a count). */
  describedBy?: string;
}) {
  // Null outside the App Router (the static UI preview).
  const path = usePathname() ?? "";
  // The planner link points at /week/current, which redirects to a real week.
  const active = href.startsWith("/week/")
    ? path.startsWith("/week/")
    : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-describedby={describedBy}
      className={`${className} ui-nav-link`}
    >
      {children}
    </Link>
  );
}
