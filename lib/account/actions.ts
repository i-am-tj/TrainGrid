"use server";

import { redirect } from "next/navigation";
import { removeMismatchedSignIn, signOutOtherDevices } from "@/lib/account/identities";
import { requireAccountOwner } from "@/lib/auth/session";

const PAGE = "/account/sign-in-methods";

export async function removeSignInAction(formData: FormData) {
  await requireAccountOwner();
  const result = await removeMismatchedSignIn(formData.get("identityId"));
  redirect(`${PAGE}?result=${result}`);
}

export async function signOutOthersAction() {
  await requireAccountOwner();
  const result = await signOutOtherDevices();
  redirect(`${PAGE}?result=${result}`);
}
