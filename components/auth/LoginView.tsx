import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { btnPrimary } from "@/lib/ui";

export type LoginViewer =
  | { status: "anonymous" }
  | { status: "not_member" }
  | { status: "member"; email: string | null; displayName: string | null };
export type LoginViewProps = {
  configured: boolean;
  viewer: LoginViewer;
  error: string | null;
  /** Forms are supplied by the server page; no auth actions live in this view. */
  providerForms: ReactNode;
};

export function LoginView({
  configured,
  viewer,
  error,
  providerForms,
}: LoginViewProps) {
  return (
    <div className="mx-auto max-w-5xl px-3 py-8 sm:px-6 sm:py-14 lg:py-20">
      <div className="ui-panel grid overflow-hidden md:grid-cols-[1fr_1fr]">
        <section
          className="min-w-0 p-6 sm:p-10 lg:p-12"
          aria-labelledby="login-title"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BrandLogo className="size-7" />
            TrainGrid
            <span className="ml-1 rounded-md border border-line px-1.5 text-[11px] font-normal text-stone-600">
              Beta
            </span>
          </div>
          <p className="ui-eyebrow mt-10">Your week starts here</p>
          <h1
            id="login-title"
            className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            Welcome to TrainGrid
          </h1>
          <p className="mt-4 text-sm leading-7 text-stone-600">
            A little structure for the training ahead. Sign in to find your
            routines and make room for the work.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900"
            >
              {error}
            </p>
          )}
          <div className="mt-7">
            {!configured ? (
              <div className="rounded-lg border border-line bg-background p-4">
                <p className="text-sm font-medium">
                  Sign-in is not available on this deployment.
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Please try again later.
                </p>
              </div>
            ) : viewer.status === "not_member" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm leading-6 text-amber-900">
                  TrainGrid is currently invite-only. Ask the person who invited
                  you to verify the email used for your account.
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  Use Sign out at the top of the page to try a different
                  account.
                </p>
              </div>
            ) : viewer.status === "member" ? (
              <div>
                <p className="text-sm leading-6 text-stone-700">
                  Signed in as{" "}
                  <span className="font-medium [overflow-wrap:anywhere]">
                    {viewer.email ?? viewer.displayName}
                  </span>
                </p>
                <Link href="/" className={`${btnPrimary} mt-5`}>
                  Go to the planner
                </Link>
              </div>
            ) : (
              <div className="space-y-3">{providerForms}</div>
            )}
          </div>
          <div className="mt-8 border-t border-line pt-5">
            <p className="text-xs font-semibold text-stone-700">
              Invite-only access
            </p>
            <p className="mt-2 text-xs leading-6 text-stone-600">
              Use the Google or GitHub account with the email address you were
              invited with. There’s no separate TrainGrid password.
            </p>
          </div>
        </section>
        <aside
          className="login-art hidden min-w-0 flex-col justify-between border-l border-line bg-background p-10 md:flex lg:p-12"
          aria-label="A simple training rhythm"
        >
          <p className="ui-eyebrow">A clear plan. Space to train.</p>
          <div className="py-10">
            <div aria-hidden="true" className="login-week-mark">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <span key={i} className={i === 2 ? "login-week-active" : ""}>
                  {day}
                  <i />
                </span>
              ))}
            </div>
            <p className="mt-8 text-4xl font-semibold leading-[1.12] tracking-tight">
              Plan the week.
              <br />
              <span className="text-accent">Own the work.</span>
            </p>
            <p className="mt-5 text-sm leading-7 text-stone-600">
              Your calendar, your routines, and a clear answer to “what am I
              doing today?”
            </p>
          </div>
          <ol className="space-y-4 text-sm">
            {[
              "Browse routines",
              "Plan your week",
              "Open a planned workout",
            ].map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-4 border-t border-line pt-4"
              >
                <span className="font-mono text-xs text-accent">0{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
