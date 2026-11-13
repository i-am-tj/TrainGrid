import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { MobileMenu } from "@/components/MobileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { isAdminViewer, parseAdminUserIds } from "@/lib/admin/access";
import { getViewer } from "@/lib/auth/session";

export async function AppHeader() {
  const viewer = await getViewer();
  const isMember = viewer.status === "member";
  // Only decides whether to show a link. The admin page and its actions
  // check again themselves.
  const isAdmin = isAdminViewer(viewer, parseAdminUserIds(process.env.TRAINGRID_ADMIN_USER_IDS));

  // One list of entries, drawn inline from `sm` up and as a vertical menu on phones.
  const items: Array<{ key: string; render: (className: string) => React.ReactNode }> = [];
  if (isMember) {
    items.push(
      { key: "planner", render: (c) => <Link href="/" className={c}>Planner</Link> },
      { key: "library", render: (c) => <Link href="/library" className={c}>Library</Link> },
      { key: "export", render: (c) => <a href="/api/export" className={c}>Export</a> },
    );
  }
  if (isAdmin) {
    items.push({
      key: "invitations",
      render: (c) => <Link href="/admin/invitations" className={c}>Invitations</Link>,
    });
  }
  if (viewer.status !== "anonymous") {
    items.push({ key: "sign-out", render: (c) => <SignOutButton className={`${c} disabled:opacity-60`} /> });
  }

  return (
    <header className="relative border-b border-line bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Link
            href={isMember ? "/" : "/login"}
            className="inline-flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <BrandLogo className="h-6 w-6 rounded-[22%] dark:outline dark:outline-1 dark:outline-hairline" />
            TrainGrid
          </Link>
          {/* Plain text, outside the link: not interactive, read as "Beta". */}
          <span className="rounded-md border border-stone-300 px-1.5 text-[11px] font-medium leading-4 text-stone-600">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <nav aria-label="Main" className="hidden items-center justify-end gap-x-2 text-sm sm:flex">
              {items.map((item) => (
                <div key={item.key}>{item.render(desktopItem)}</div>
              ))}
            </nav>
          ) : null}
          {/* On every page, signed in or not. */}
          <ThemeToggle />
          {items.length > 0 ? (
            <MobileMenu>
              {items.map((item) => (
                <li key={item.key}>{item.render(mobileItem)}</li>
              ))}
            </MobileMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}

const desktopItem = "rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100";
const mobileItem =
  "block w-full rounded-md px-2 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900";
