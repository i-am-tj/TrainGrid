import type { Metadata } from "next";
import { LoginView } from "@/components/auth/LoginView";
import { ProviderSubmit } from "@/components/auth/ProviderSubmit";
import { signInWithProvider } from "@/lib/auth/actions";
import { OAUTH_PROVIDERS, loginErrorMessage } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · TrainGrid",
};

type SearchParams = Promise<{
  error?: string | string[];
  next?: string | string[];
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const configured = getSupabaseEnv() !== null;
  const error = loginErrorMessage(first(params.error));
  const nextPath = safeNextPath(first(params.next));
  const viewer = await getViewer();

  return (
    <LoginView
      configured={configured}
      viewer={viewer}
      error={error}
      providerForms={OAUTH_PROVIDERS.map((provider) => (
        <form key={provider.id} action={signInWithProvider}>
          <input type="hidden" name="provider" value={provider.id} />
          <input type="hidden" name="next" value={nextPath} />
          <ProviderSubmit provider={provider.id} label={provider.label} />
        </form>
      ))}
    />
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
