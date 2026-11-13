"use server";

import { redirect } from "next/navigation";
import { approveSignInMethod, removeSignInMethod } from "@/lib/account/identities";
import { requireMember } from "@/lib/auth/session";

const PAGE = "/account/sign-in-methods";

export async function approveIdentityAction(formData: FormData) {
  await requireMember();
  const result = await approveSignInMethod(formData.get("identityId"));
  redirect(`${PAGE}?result=${result}`);
}

export async function removeIdentityAction(formData: FormData) {
  await requireMember();
  const result = await removeSignInMethod(formData.get("identityId"));
  redirect(`${PAGE}?result=${result}`);
}
