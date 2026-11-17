"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
}) {
  const path = usePathname();
  // The planner link points at /week/current, which redirects to a real week.
  const active = href.startsWith("/week/")
    ? path.startsWith("/week/")
    : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ui-nav-link`}
    >
      {children}
    </Link>
  );
}
