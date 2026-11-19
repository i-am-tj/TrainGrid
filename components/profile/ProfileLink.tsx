"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileAvatar } from "./ProfileAvatar";

/**
 * The way to the member's profile: their initials from `sm` up (right of the
 * theme switch, as in most apps), a labelled row in the phone menu.
 */
export function ProfileLink({ name, initials, inline = false }: { name: string; initials: string; inline?: boolean }) {
  const active = usePathname() === "/profile";
  if (inline) {
    return (
      <Link
        href="/profile"
        aria-current={active ? "page" : undefined}
        className="ui-nav-link flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
      >
        <ProfileAvatar initials={initials} size="sm" />
        <span className="min-w-0">
          <span className="block font-medium text-foreground">Profile</span>
          <span className="block truncate text-xs text-stone-600">{name}</span>
        </span>
      </Link>
    );
  }
  return (
    <Link
      href="/profile"
      aria-label="Profile"
      title={name}
      aria-current={active ? "page" : undefined}
      className="group hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:inline-flex"
    >
      <span className="rounded-full p-px transition-shadow duration-200 group-hover:shadow-[0_0_0_2px_var(--accent)] group-aria-[current=page]:shadow-[0_0_0_2px_var(--accent)] motion-reduce:transition-none">
        <ProfileAvatar initials={initials} size="sm" />
      </span>
    </Link>
  );
}
