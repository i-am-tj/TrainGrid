import type { Metadata } from "next";
import { removeSignInAction, signOutOthersAction } from "@/lib/account/actions";
import { accountSignIns, type AccountResult, type SignInMethod } from "@/lib/account/identities";
import { requireAccountOwner } from "@/lib/auth/session";
import { btnDanger, btnSecondary } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign-in methods · TrainGrid",
  robots: { index: false, follow: false },
};

const PROVIDER: Record<SignInMethod["provider"], string> = {
  google: "Google",
  github: "GitHub",
  email: "Email",
  other: "Other",
};

const RESULT: Record<AccountResult, { text: string; ok: boolean }> = {
  removed: { text: "Sign-in method removed.", ok: true },
  signed_out: { text: "Signed out of every other device.", ok: true },
  kept: { text: "Sign-ins on your account's email address are not removed here.", ok: false },
  manual_linking_off: {
    text: "Removing sign-in methods is switched off. Ask the person who runs TrainGrid to allow it for a few minutes.",
    ok: false,
  },
  error: { text: "That change could not be made. Please try again.", ok: false },
};

function formatDate(iso: string | null): string {
  if (!iso) return "unknown date";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

export default async function SignInMethodsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string | string[] }>;
}) {
  const viewer = await requireAccountOwner();
  const { canonicalEmail, methods } = await accountSignIns();
  const raw = (await searchParams).result;
  const key = typeof raw === "string" && Object.hasOwn(RESULT, raw) ? (raw as AccountResult) : null;
  const result = key ? RESULT[key] : null;
  const locked = viewer.status === "locked";

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Sign-in methods</h1>
      <p className="mt-1 text-sm text-stone-600">
        Every way into your account must use your invited email address
        {canonicalEmail ? (
          <>
            , <span className="font-medium text-stone-800 break-all">{canonicalEmail}</span>
          </>
        ) : null}
        . Google or GitHub can link a sign-in with another address on their own; when that happens,
        TrainGrid locks the account until it is removed.
      </p>

      {locked ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your account is locked: a sign-in with a different email address is linked to it. Remove
          it below, then sign out of other devices.
        </p>
      ) : null}

      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {result.text}
        </p>
      ) : null}

      <ul className="mt-5 divide-y divide-line rounded-lg border border-line bg-card">
        {methods.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <div className="font-medium">
                {PROVIDER[m.provider]}
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    m.matches ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {m.matches ? "Your email" : "Different email"}
                </span>
              </div>
              <div className="break-all text-sm text-stone-600">{m.email ?? "No email address"}</div>
              <div className="text-xs text-stone-500">Linked {formatDate(m.linkedAt)} UTC</div>
            </div>
            {!m.matches ? (
              <form action={removeSignInAction}>
                <input type="hidden" name="identityId" value={m.id} />
                <button type="submit" className={btnDanger} aria-label={`Remove ${PROVIDER[m.provider]} ${m.email ?? ""}`.trim()}>
                  Remove
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      <form action={signOutOthersAction} className="mt-5">
        <button type="submit" className={btnSecondary}>
          Sign out of other devices
        </button>
        <p className="mt-1 text-xs text-stone-500">
          Ends every other session at once, including any opened through a removed sign-in.
        </p>
      </form>
    </div>
  );
}
