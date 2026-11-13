/**
 * Who may manage invitations. Pure functions, no I/O.
 *
 * Admins are listed by Supabase user id in the server-only environment
 * variable TRAINGRID_ADMIN_USER_IDS. Nothing sent by the browser is ever
 * consulted.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parses a comma- or whitespace-separated list of user ids, ignoring anything that is not a UUID. */
export function parseAdminUserIds(raw: string | undefined): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const part of (raw ?? "").split(/[\s,]+/)) {
    const id = part.trim().toLowerCase();
    if (UUID.test(id)) ids.add(id);
  }
  return ids;
}

type ViewerLike = { status: "anonymous" } | { status: "not_member" | "member" | "locked"; userId: string };

/**
 * An admin is a member whose user id is on the list. A listed id that is not
 * (yet) a member is not an admin, and an empty list means there are none.
 */
export function isAdminViewer(viewer: ViewerLike, adminIds: ReadonlySet<string>): boolean {
  return viewer.status === "member" && adminIds.has(viewer.userId.toLowerCase());
}
