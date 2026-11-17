"use client";

import { useFormStatus } from "react-dom";
import type { OAuthProviderId } from "@/lib/auth/providers";
import { ProviderButton } from "./ProviderButton";

/** Must remain inside its existing provider form to observe the real Server Action. */
export function ProviderSubmit({
  provider,
  label,
}: {
  provider: OAuthProviderId;
  label: string;
}) {
  const { pending } = useFormStatus();
  return <ProviderButton provider={provider} label={label} pending={pending} />;
}
