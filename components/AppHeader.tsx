import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ImportExport } from "@/components/ImportExport";
import { isAdminViewer, parseAdminUserIds } from "@/lib/admin/access";
import { getViewer } from "@/lib/auth/session";
import { isPublishedReadonly } from "@/lib/runtime";

export async function AppHeader() {
  const readonly = isPublishedReadonly();
  const viewer = await getViewer();
  const isMember = viewer.status === "member";
  // Only decides whether to show a link. The admin page and its actions
  // check again themselves.
  const isAdmin = isAdminViewer(viewer, parseAdminUserIds(process.env.TRAINGRID_ADMIN_USER_IDS));

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-3 sm:px-4">
        <Link href={isMember ? "/" : "/login"} className="text-base font-semibold tracking-tight">
          TrainGrid
        </Link>
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-1 text-sm sm:gap-x-2">
          {isMember ? (
            <>
              <Link
                href="/"
                className="rounded-md px-1.5 py-1 text-stone-700 hover:bg-stone-100 sm:px-2"
              >
                Planner
              </Link>
              <Link
                href="/library"
                className="rounded-md px-1.5 py-1 text-stone-700 hover:bg-stone-100 sm:px-2"
              >
                Library
              </Link>
            </>
          ) : null}
          {!isMember ? null : readonly ? (
            <span className="rounded-md bg-amber-50 px-1.5 py-1 text-[11px] font-medium text-amber-950 sm:px-2 sm:text-xs">
              <span className="sm:hidden">Published</span>
              <span className="hidden sm:inline">Published · read-only</span>
            </span>
          ) : (
            <ImportExport />
          )}
          {isAdmin ? (
            <Link
              href="/admin/invitations"
              className="rounded-md px-1.5 py-1 text-stone-700 hover:bg-stone-100 sm:px-2"
            >
              Invitations
            </Link>
          ) : null}
          {viewer.status !== "anonymous" ? (
            <SignOutButton className="rounded-md px-1.5 py-1 text-stone-700 hover:bg-stone-100 disabled:opacity-60 sm:px-2" />
          ) : null}
        </nav>
      </div>
    </header>
  );
}
