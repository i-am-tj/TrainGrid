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
  const active =
    href === "/"
      ? path === "/" || path.startsWith("/week/")
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
