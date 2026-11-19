import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { MobileMenu } from "@/components/MobileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLink } from "@/components/ui/NavLink";

/** What's new and the legal pages: the public header's navigation. */
export const INFO_LINKS = [
  { name: "What’s new", href: "/whats-new" },
  { name: "Privacy", href: "/privacy" },
  { name: "Terms", href: "/terms" },
] as const;

const desktopLink = "rounded-md px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-foreground";
const mobileLink =
  "block w-full rounded-md px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900";

/** The header's sign-in button: a compact pill the height of the theme switch, on every width. */
export const loginPill =
  "ui-control inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";

/**
 * Public shell for the landing page and the information pages; no viewer
 * data or admin controls. Navigation is What's new, Privacy and Terms (inline
 * from `sm`, in the menu on phones); Log in stays in the bar at every width.
 */
export function PublicHeader({ showLogin = true }: { showLogin?: boolean }) {
  return (
    <header className="relative z-30 border-b border-line bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="inline-flex items-center gap-2 text-base font-semibold tracking-tight">
            <BrandLogo />
            TrainGrid
          </Link>
          <span className="hidden rounded-md border border-line px-1.5 text-[11px] leading-4 text-stone-600 min-[360px]:inline">
            Early access
          </span>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <InfoNav />
          <ThemeToggle />
          {showLogin ? (
            <Link href="/login" className={loginPill}>
              Log in
            </Link>
          ) : null}
          <InfoMenu />
        </div>
      </div>
    </header>
  );
}

/** The information links inline, from `sm` up. */
export function InfoNav() {
  return (
    <nav aria-label="Main" className="hidden sm:block">
      <ul className="flex items-center gap-1">
        {INFO_LINKS.map(({ name, href }) => (
          <li key={href}>
            <NavLink href={href} className={desktopLink}>
              {name}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The information links in the phone menu. */
export function InfoMenu() {
  return (
    <MobileMenu>
      {INFO_LINKS.map(({ name, href }) => (
        <li key={href}>
          <NavLink href={href} className={mobileLink}>
            {name}
          </NavLink>
        </li>
      ))}
    </MobileMenu>
  );
}
