import Link from "next/link";
import type { OnboardingStep } from "@/lib/onboarding/model";
import { hideOnboardingAction } from "@/lib/onboarding/actions";
import { btnSecondaryCompact } from "@/lib/ui";

/**
 * Getting started on /home: three steps that tick themselves off from the
 * member's own data. Hidden for good once all are done, or on this device
 * when the member hides it (a cookie read on the server, so it never flashes).
 */
export function GettingStarted({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((step) => step.done).length;
  const percent = Math.round((done / steps.length) * 100);
  return (
    <section
      aria-labelledby="getting-started-title"
      className="ui-panel relative overflow-hidden p-3 sm:p-6"
      data-testid="getting-started"
    >
      {/* A soft wash of the accent in one corner. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="ui-eyebrow">Getting started</p>
          <h2 id="getting-started-title" className="mt-2 text-xl font-semibold tracking-tight">
            Make TrainGrid yours
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Three small steps to a week that plans itself around you.
          </p>
        </div>
        <form action={hideOnboardingAction}>
          <button
            type="submit"
            aria-label="Hide getting started"
            title="Hide"
            className="ui-control inline-flex size-9 shrink-0 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </form>
      </div>

      <div className="relative mt-5 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Getting started progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
          aria-valuetext={`${done} of ${steps.length} steps done`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="shrink-0 text-xs font-medium text-stone-600">
          {done} of {steps.length} done
        </p>
      </div>

      <ol className="relative mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`flex min-w-0 flex-col rounded-xl border p-4 ${step.done ? "border-line bg-background/40" : "border-line bg-card"}`}
          >
            <div className="flex items-center gap-3">
              {step.done ? (
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="ui-check-draw size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-stone-300 font-mono text-xs text-stone-600"
                >
                  {index + 1}
                </span>
              )}
              <h3 className={`text-sm font-semibold ${step.done ? "text-stone-600" : ""}`}>
                {step.title}
                {step.done ? <span className="sr-only"> (done)</span> : null}
              </h3>
            </div>
            <p className="mt-2 flex-1 text-sm leading-6 text-stone-600">{step.description}</p>
            <div className="mt-4">
              {step.done ? (
                <p className="inline-flex min-h-8 items-center text-xs font-medium text-accent" aria-hidden="true">
                  Done
                </p>
              ) : (
                <Link href={step.href} className={btnSecondaryCompact}>
                  {step.actionLabel} <span aria-hidden="true" className="ml-2">→</span>
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
