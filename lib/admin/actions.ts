"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { emailFeedback, type EmailFeedback } from "@/lib/admin/invitation-model";
import { dismissInviteRequest } from "@/lib/admin/invite-requests";
import {
  NotAdminError,
  createInvitation,
  invitationEmailReady,
  revokeInvitation,
  sendInvitationEmail,
  type MutationResult,
} from "@/lib/admin/invitations";

/**
 * `message` reports the membership invitation itself. `email` reports the
 * optional invitation email separately, so a failed send never reads as a
 * failed invitation: the invitation exists and works either way.
 */
export type InvitationFormState = { message: string; ok: boolean; email?: EmailFeedback } | null;
export type EmailActionState = EmailFeedback | null;

const PAGE = "/admin/invitations";

/** Runs an admin mutation; a caller who is not an admin gets a 404, as the page does. */
async function run(
  mutation: () => Promise<MutationResult>,
): Promise<{ ok: true; id?: string } | { ok: false; state: InvitationFormState }> {
  let result: MutationResult;
  try {
    result = await mutation();
  } catch (error) {
    if (error instanceof NotAdminError) notFound();
    return { ok: false, state: { ok: false, message: "Something went wrong. Please try again." } };
  }
  if (!result.ok) return { ok: false, state: { ok: false, message: result.message } };
  revalidatePath(PAGE);
  return result;
}

/** Sends the email for an invitation; any unexpected failure is reported, never thrown. */
async function sendFor(invitationId: string): Promise<EmailFeedback> {
  try {
    return emailFeedback(await sendInvitationEmail(invitationId));
  } catch (error) {
    if (error instanceof NotAdminError) notFound();
    return emailFeedback({ kind: "error" });
  } finally {
    revalidatePath(PAGE);
  }
}

export async function inviteAction(
  _previous: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const created = await run(() => createInvitation(formData.get("email")));
  if (!created.ok) return created.state;

  const state: NonNullable<InvitationFormState> = { ok: true, message: "Invitation created." };
  if (formData.get("send_email") === "on" && created.id) {
    state.email = invitationEmailReady()
      ? await sendFor(created.id)
      : emailFeedback({ kind: "not_configured" });
  }
  return state;
}

/** Send or resend the invitation email for an existing invitation. Admins only. */
export async function sendInvitationEmailAction(
  _previous: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  return sendFor(String(formData.get("id") ?? ""));
}

export async function revokeAction(
  _previous: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const result = await run(() => revokeInvitation(formData.get("id")));
  return result.ok ? { ok: true, message: "Revoked." } : result.state;
}

/** Declines an invite request. Admins only. */
export async function dismissInviteRequestAction(
  _previous: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const result = await run(() => dismissInviteRequest(formData.get("id")));
  return result.ok ? { ok: true, message: "Request dismissed." } : result.state;
}
