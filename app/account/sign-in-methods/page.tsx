import type { Metadata } from "next";
import { approveIdentityAction, removeIdentityAction } from "@/lib/account/actions";
import { listSignInMethods, type IdentityResult, type SignInMethod } from "@/lib/account/identities";
import { requireMember } from "@/lib/auth/session";
import { btnDanger, btnPrimary } from "@/lib/ui";

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

const RESULT: Record<IdentityResult, { text: string; ok: boolean }> = {
  approved: { text: "Sign-in method approved.", ok: true },
  removed: { text: "Sign-in method removed.", ok: true },
  reauth: {
    text: "For safety, approving needs a recent sign-in. Sign out, sign in again, and approve within 10 minutes.",
    ok: false,
  },
  current: { text: "You cannot remove the method you are signed in with right now.", ok: false },
  last: { text: "Your account needs at least one sign-in method.", ok: false },
  error: { text: "That change could not be made. Please try again.", ok: false },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

export default async function SignInMethodsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string | string[] }>;
}) {
  await requireMember();
  const methods = await listSignInMethods();
  const raw = (await searchParams).result;
  const key = typeof raw === "string" && Object.hasOwn(RESULT, raw) ? (raw as IdentityResult) : null;
  const result = key ? RESULT[key] : null;

  return (
    <div className="mx-auto max-w-xl px-3 py-4 sm:px-4">
      <h1 className="text-xl font-semibold">Sign-in methods</h1>
      <p className="mt-1 text-sm text-stone-600">
        Ways into your TrainGrid account. Google or GitHub can add a sign-in here when it shares an
        email address with one you already use. A method with a different address works only after
        you approve it. Remove anything you do not recognise.
      </p>

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
                    m.approved ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {m.approved ? "Approved" : "Needs approval"}
                </span>
                {m.thisSession ? (
                  <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600">
                    This sign-in
                  </span>
                ) : null}
              </div>
              <div className="break-all text-sm text-stone-600">{m.email ?? "No email address"}</div>
              <div className="text-xs text-stone-500">Added {formatDate(m.linkedAt)} UTC</div>
            </div>
            <div className="flex shrink-0 gap-2">
              {!m.approved ? (
                <form action={approveIdentityAction}>
                  <input type="hidden" name="identityId" value={m.id} />
                  <button type="submit" className={btnPrimary} aria-label={`Approve ${PROVIDER[m.provider]} ${m.email ?? ""}`.trim()}>
                    Approve
                  </button>
                </form>
              ) : null}
              {!m.thisSession && methods.length > 1 ? (
                <form action={removeIdentityAction}>
                  <input type="hidden" name="identityId" value={m.id} />
                  <button type="submit" className={btnDanger} aria-label={`Remove ${PROVIDER[m.provider]} ${m.email ?? ""}`.trim()}>
                    Remove
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
