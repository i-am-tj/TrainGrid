import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { MobileMenu } from "@/components/MobileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { btnSecondary } from "@/lib/ui";

/** Public shell for the future landing route; no viewer data or admin controls. */
export function PublicHeader() {
  const links = (
    <>
      <li>
        <a
          href="#features"
          className="block rounded-md px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100"
        >
          Features
        </a>
      </li>
      <li>
        <a
          href="#about"
          className="block rounded-md px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-100"
        >
          About
        </a>
      </li>
      <li>
        <Link href="/login" className={`${btnSecondary} whitespace-nowrap`}>
          Log in
        </Link>
      </li>
    </>
  );
  return (
    <header className="relative z-30 border-b border-line bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <BrandLogo />
            TrainGrid
          </Link>
          <span className="rounded-md border border-line px-1.5 text-[11px] leading-4 text-stone-600">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Main" className="hidden sm:block">
            <ul className="flex items-center gap-2">{links}</ul>
          </nav>
          <ThemeToggle />
          <MobileMenu>{links}</MobileMenu>
        </div>
      </div>
    </header>
  );
}
