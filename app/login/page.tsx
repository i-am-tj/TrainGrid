import type { Metadata } from "next";
import { signInWithProvider, signOut } from "@/lib/auth/actions";
import { OAUTH_PROVIDERS, loginErrorMessage } from "@/lib/auth/providers";
import { safeNextPath } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · TrainGrid",
};

type SearchParams = Promise<{ error?: string | string[]; next?: string | string[] }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const configured = getSupabaseEnv() !== null;
  const error = loginErrorMessage(first(params.error));
  const nextPath = safeNextPath(first(params.next));
  const viewer = await getViewer();

  return (
    <div className="mx-auto max-w-sm px-3 py-12 sm:py-20">
      <div className="rounded-2xl border border-line bg-card px-5 py-7 text-center sm:px-7">
        <h1 className="text-xl font-semibold tracking-tight">Welcome to TrainGrid</h1>
        <p className="mt-1.5 text-sm text-stone-600">Invite-only access</p>

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            {error}
          </p>
        ) : null}

        {!configured ? (
          <p className="mt-6 text-sm text-stone-600">
            Sign-in is not available on this deployment.
          </p>
        ) : viewer.status === "not_member" ? (
          <div className="mt-6">
            <p className="text-sm text-stone-700">
              TrainGrid is currently invite-only. Ask the person who invited you to verify the
              email used for your account.
            </p>
            <form action={signOut} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : viewer.status === "member" ? (
          <div className="mt-6">
            <p className="text-sm text-stone-700">
              Signed in as{" "}
              <span className="font-medium break-all">{viewer.email ?? viewer.displayName}</span>
            </p>
            <form action={signOut} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-6 space-y-2.5">
            {OAUTH_PROVIDERS.map((provider) => (
              <form key={provider.id} action={signInWithProvider}>
                <input type="hidden" name="provider" value={provider.id} />
                <input type="hidden" name="next" value={nextPath} />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
                >
                  {provider.label}
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
