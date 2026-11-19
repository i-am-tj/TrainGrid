import Image from "next/image";
import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import {
  AgendaPreview,
  LibraryPreview,
  PlannerPreview,
  WorkoutPreview,
} from "./ProductPreview";

const FEATURES = [
  [
    "week",
    "Weekly training planner",
    "Give every session a place. See Monday through Sunday together, or focus on one day.",
  ],
  [
    "library",
    "A shared workout library",
    "Find running, strength and plyometrics routines. Browse, filter and make a plan.",
  ],
  [
    "routine",
    "Routines that feel like yours",
    "Build a personal routine or copy a TrainGrid favourite. Keep the details that matter to you.",
  ],
  [
    "time",
    "Your time. Your schedule.",
    "Set a start time and optional duration, or leave a session untimed. Plans can be flexible.",
  ],
  [
    "snapshot",
    "A workout of its own",
    "Every scheduled session keeps an independent snapshot. Edit a routine without rewriting your week.",
  ],
  [
    "equipment",
    "Find the right fit",
    "Search by exercise, category and equipment to find a routine that fits your setup.",
  ],
] as const;

/** Landing calls to action: one height, label and arrow kept together. */
const cta = (base: string) =>
  base.replace("min-h-10", "min-h-12 gap-2").replace("rounded-md", "rounded-full").replace("px-3 py-2", "px-6 py-3");
const ctaPrimary = cta(btnPrimary);
const ctaSecondary = cta(btnSecondary);
const ctaArrow = "transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none";

export type LandingPageProps = { creatorRole?: string };

/** Ready for public routing; intentionally has no auth, database or fixture imports. */
export function LandingPage({
  creatorRole = "Founder & Developer",
}: LandingPageProps) {
  return (
    <div className="landing">
      <section className="landing-hero landing-container">
        <div className="hero-copy">
          <p className="ui-eyebrow">A clear plan. Space to train.</p>
          <h1 className="mt-5 text-[clamp(2.8rem,6vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.055em]">
            Plan the week.
            <br />
            <span className="text-accent">Own the work.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-stone-600">
            A considered home for your training week. Find a routine, put it on
            the calendar, and know what’s next when it’s time to train.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className={`${ctaPrimary} group`}>
              Log in
              <span aria-hidden="true" className={ctaArrow}>→</span>
            </Link>
            <a href="#features" className={ctaSecondary}>
              Explore features
            </a>
          </div>
          <p className="mt-5 text-xs leading-5 text-stone-600">
            Access is by invitation. Use the email address on your invitation.
            {" "}<Link href="/login?request=invite" className="underline-reveal text-accent">No invitation yet? Request one</Link>
          </p>
        </div>
        <div className="hero-product">
          <div className="hero-orbit" aria-hidden="true" />
          <div className="hidden sm:block">
            <PlannerPreview />
          </div>
          <div className="sm:hidden">
            <AgendaPreview headingTag="p" />
          </div>
          <p className="mt-4 text-right font-mono text-[10px] uppercase tracking-widest text-stone-600">
            01 — Make room for the work
          </p>
        </div>
      </section>

      <section
        id="features"
        tabIndex={-1}
        className="landing-container landing-section"
        aria-labelledby="features-title"
      >
        <div className="section-intro landing-reveal">
          <p className="ui-eyebrow">The essentials, thoughtfully together</p>
          <h2 id="features-title" className="landing-heading">
            Less figuring it out.
            <br />
            More getting to it.
          </h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map(([icon, title, description]) => (
            <article
              key={icon}
              className="feature-card"
            >
              <svg
                aria-hidden="true"
                className="mb-7 size-10 text-accent"
                viewBox="0 0 40 40"
              >
                <use href={`/marketing/features.svg#${icon}`} />
              </svg>
              <h3 className="text-base font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="preview"
        tabIndex={-1}
        className="landing-section border-y border-line bg-card"
        aria-labelledby="showcase-title"
      >
        <div className="landing-container">
          <div className="section-intro landing-reveal">
            <p className="ui-eyebrow">From the big picture to the next set</p>
            <h2 id="showcase-title" className="landing-heading">
              One plan.
              <br />
              Every useful detail.
            </h2>
          </div>
          <div className="showcase-grid">
            <div className="showcase-agenda">
              <AgendaPreview />
            </div>
            <div>
              <LibraryPreview />
              <p className="mt-4 text-xs text-stone-600">
                02 — Find your next routine
              </p>
            </div>
            <div>
              <WorkoutPreview />
              <p className="mt-4 text-xs text-stone-600">
                03 — Know the planned work
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="access"
        tabIndex={-1}
        aria-labelledby="access-title"
        className="landing-final border-t border-line bg-card"
      >
        <div className="landing-container grid gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div id="about" className="creator-card ui-panel bg-background p-6 sm:p-8">
            <h2 id="creator-title" className="ui-eyebrow landing-reveal border-b border-line pb-4">
              A note from the founder
            </h2>
            <div className="creator-layout mt-6">
              <div className="creator-mark">
                <Image
                  src="/marketing/tanuj-chakraborty.jpg"
                  alt="Tanuj Chakraborty"
                  width={1170}
                  height={1170}
                  unoptimized
                  loading="lazy"
                  className="aspect-square w-36 max-w-full rounded-2xl border border-hairline object-cover sm:w-44"
                />
              </div>
              <div className="creator-details">
                <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tanuj Chakraborty</h3>
                <p className="mt-1.5 text-sm text-accent">{creatorRole}</p>
                <p className="mt-4 border-l-2 border-accent pl-4 text-base leading-7 text-pretty text-stone-800 sm:text-lg sm:leading-8">
                  I built TrainGrid to give training a deliberate place in your
                  week, so you can find routines worth keeping, make them your
                  own, and arrive at each session knowing what’s ahead.
                </p>
                <p className="mt-4 border-t border-line pt-3 text-sm leading-6 text-muted">
                  More of my work: my{" "}
                  <a
                    className="font-medium text-accent underline underline-offset-4"
                    href="https://iamtj.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    portfolio
                  </a>
                  {" "}and{" "}
                  <a
                    className="font-medium text-accent underline underline-offset-4"
                    href="https://github.com/i-am-tj"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </a>.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="ui-eyebrow">Your next week starts here</p>
            <h2 id="access-title" className="landing-heading landing-reveal">
              Make a plan.
              <br />
              Show up.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-stone-600">
              TrainGrid is invite-only. If you’ve been invited, log in with Google or GitHub using
              that email address. If not, request an invite: every request is reviewed personally.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login" className={`${ctaPrimary} group`}>
                Log in to TrainGrid
                <span aria-hidden="true" className={ctaArrow}>→</span>
              </Link>
              <Link href="/login?request=invite" className={ctaSecondary}>
                Request an invite
              </Link>
            </div>
            <p className="mt-6 text-xs leading-5 text-stone-600">
              Access is approved one person at a time; there is no public sign-up.
            </p>
            <a href="#top" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm pr-2 text-sm font-medium text-accent">
              <span className="underline-reveal">Back to top</span>
              <span aria-hidden="true">↑</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
