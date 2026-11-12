import { z } from "zod";

/** Pure invitation helpers shared by the server functions and the page. */

export type InvitationRow = {
  id: string;
  email: string;
  created_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
};

export type InvitationStatus = "Pending" | "Accepted" | "Revoked";

export function invitationStatus(row: Pick<InvitationRow, "accepted_at" | "revoked_at">): InvitationStatus {
  if (row.revoked_at) return "Revoked";
  if (row.accepted_at) return "Accepted";
  return "Pending";
}

/**
 * What an admin may revoke for this row:
 *   "invitation" — a pending invitation;
 *   "access"     — an accepted member's access (their data is kept);
 *   null         — nothing (already revoked, or the member is an admin).
 */
export type RevokeKind = "invitation" | "access" | null;

export function revokeKind(
  row: Pick<InvitationRow, "accepted_at" | "accepted_by" | "revoked_at">,
  protectedUserIds: ReadonlySet<string>,
): RevokeKind {
  if (row.revoked_at) return null;
  if (!row.accepted_at) return "invitation";
  if (row.accepted_by && protectedUserIds.has(row.accepted_by.toLowerCase())) return null;
  return "access";
}

/** Email as stored and matched: trimmed and lower-cased. */
export const invitationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(320)
  .pipe(z.email());

export const invitationIdSchema = z.uuid();
