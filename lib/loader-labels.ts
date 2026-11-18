/**
 * What the page loader says while a member navigates to `pathname`. The words
 * match the section loader the destination shows once its frame is on screen,
 * so the two read as one loading state.
 */
export function loaderLabelFor(pathname: string): string {
  if (pathname === "/week" || pathname.startsWith("/week/")) {
    return /^\/week\/[^/]+\/add$/.test(pathname) ? "Loading page…" : "Loading your calendar…";
  }
  if (pathname === "/home") return "Loading your home…";
  if (pathname === "/library") return "Loading routines…";
  if (pathname === "/profile") return "Loading your profile…";
  if (pathname === "/admin/invitations") return "Loading invitations…";
  if (pathname === "/") return "Loading TrainGrid…";
  return "Loading page…";
}
