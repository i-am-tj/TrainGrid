import "server-only";

import { isAdminViewer, parseAdminUserIds } from "@/lib/admin/access";
import { getViewer, type Viewer } from "@/lib/auth/session";

export type AdminViewer = Extract<Viewer, { status: "member" }>;

/**
 * Returns the current user if they are an admin, otherwise null.
 *
 * Identity comes from the verified session, membership from the database,
 * and the admin list from a server-only environment variable. Every admin
 * page and every admin server action calls this itself; none relies on a
 * caller, a route check or the UI having done so.
 */
export async function getAdminViewer(): Promise<AdminViewer | null> {
  const viewer = await getViewer();
  const adminIds = parseAdminUserIds(process.env.TRAINGRID_ADMIN_USER_IDS);
  return viewer.status === "member" && isAdminViewer(viewer, adminIds) ? viewer : null;
}
