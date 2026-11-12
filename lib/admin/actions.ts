"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  NotAdminError,
  createInvitation,
  revokeInvitation,
  type MutationResult,
} from "@/lib/admin/invitations";

export type InvitationFormState = { message: string; ok: boolean } | null;

const PAGE = "/admin/invitations";

/** Runs an admin mutation; a caller who is not an admin gets a 404, as the page does. */
async function run(mutation: () => Promise<MutationResult>): Promise<InvitationFormState> {
  let result: MutationResult;
  try {
    result = await mutation();
  } catch (error) {
    if (error instanceof NotAdminError) notFound();
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(PAGE);
  return { ok: true, message: "" };
}

export async function inviteAction(
  _previous: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const state = await run(() => createInvitation(formData.get("email")));
  return state?.ok ? { ok: true, message: "Invitation created." } : state;
}

export async function revokeAction(
  _previous: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const state = await run(() => revokeInvitation(formData.get("id")));
  return state?.ok ? { ok: true, message: "Revoked." } : state;
}
