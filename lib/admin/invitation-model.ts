import { z } from "zod";

/** Pure invitation helpers shared by the server functions and the page. */

export type InvitationRow = {
  id: string;
  email: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type InvitationStatus = "Pending" | "Accepted" | "Revoked";

export function invitationStatus(row: Pick<InvitationRow, "accepted_at" | "revoked_at">): InvitationStatus {
  if (row.revoked_at) return "Revoked";
  if (row.accepted_at) return "Accepted";
  return "Pending";
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
