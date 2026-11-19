import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
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

export type LandingPageProps = { creatorRole?: string };

/** Ready for public routing; intentionally has no auth, database or fixture imports. */
export function LandingPage({
  creatorRole = "Founder & Developer",
}: LandingPageProps) {
  return (
    <div className="landing">
      <section className="landing-hero landing-container">
        <div className="hero-copy">
          <div className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <BrandLogo className="size-7" />
            TrainGrid
            <span className="ml-1 rounded-md border border-line px-2 py-0.5 text-[11px] font-normal text-stone-600">
              Invite-only early access
            </span>
          </div>
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
            <Link href="/login" className={`${btnPrimary} gap-8 !px-5 !py-3`}>
              Log in <span aria-hidden="true">↗</span>
            </Link>
            <a href="#features" className={`${btnSecondary} !px-5 !py-3`}>
              Explore features
            </a>
          </div>
          <p className="mt-5 text-xs leading-5 text-stone-600">
            Access is by invitation. Use the email address on your invitation.
            {" "}<a href="#access" className="underline-reveal text-accent">No invitation yet?</a>
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
        className="landing-container landing-section scroll-mt-8"
        aria-labelledby="features-title"
      >
        <div className="section-intro">
          <p className="ui-eyebrow">The essentials, thoughtfully together</p>
          <h2 id="features-title" className="landing-heading">
            Less figuring it out.
            <br />
            More getting to it.
          </h2>
          <p className="max-w-md text-sm leading-7 text-stone-600">
            Your calendar and workout reference, in one place. Enough structure
            to stay intentional. Enough flexibility to make it yours.
          </p>
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
        className="landing-section border-y border-line bg-card"
        aria-labelledby="showcase-title"
      >
        <div className="landing-container">
          <div className="section-intro">
            <p className="ui-eyebrow">From the big picture to the next set</p>
            <h2 id="showcase-title" className="landing-heading">
              One plan.
              <br />
              Every useful detail.
            </h2>
            <p className="max-w-md text-sm leading-7 text-stone-600">
              See the full week on desktop, take the day’s agenda on your phone,
              and open the workout when you need it.
            </p>
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
        className="landing-container landing-section"
        aria-labelledby="steps-title"
      >
        <p className="ui-eyebrow">A simple rhythm</p>
        <h2 id="steps-title" className="landing-heading">
          Browse. Plan. Open.
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            [
              "Browse routines",
              "Start with the shared library, or create something personal.",
            ],
            [
              "Plan your week",
              "Schedule the sessions around the rest of your life.",
            ],
            [
              "Open a planned workout",
              "Your instructions, equipment and workout details are ready.",
            ],
          ].map(([title, copy], i) => (
            <li key={title} className="border-t border-line pt-5">
              <span className="font-mono text-xs text-accent">0{i + 1}</span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-stone-600">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        id="about"
        className="landing-container pb-20"
        aria-labelledby="creator-title"
      >
        <div className="creator-card ui-panel mx-auto max-w-5xl p-7 sm:p-10">
          <h2
            id="creator-title"
            className="ui-eyebrow border-b border-line pb-5"
          >
            A note from the founder
          </h2>
          <div className="creator-layout mt-8">
            <div className="creator-mark">
              <Image
                src="/marketing/tanuj-chakraborty.jpg"
                alt="Tanuj Chakraborty"
                width={1170}
                height={1170}
                unoptimized
                loading="lazy"
                className="aspect-square w-44 max-w-full rounded-2xl border border-hairline object-cover sm:w-56"
              />
            </div>
            <div className="creator-details">
              <figure>
                <blockquote className="max-w-2xl text-xl leading-relaxed tracking-tight sm:text-2xl">
                  <p>
                    I built TrainGrid to give training a deliberate place in your
                    week, so you can find routines worth keeping, make them your
                    own, and arrive at each session knowing what’s ahead.
                  </p>
                </blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="block font-semibold">Tanuj Chakraborty</span>
                  <span className="mt-1 block text-muted">{creatorRole}</span>
                </figcaption>
              </figure>
              <p className="mt-5 max-w-2xl border-t border-line pt-4 text-sm leading-6 text-muted">
                For more of my work, visit my{" "}
                <a
                  className="font-medium text-accent underline underline-offset-4"
                  href="https://iamtj.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  portfolio
                </a>
                {" "}or explore my projects on{" "}
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
      </section>

      <section id="access" aria-labelledby="access-title" className="scroll-mt-8 border-t border-line bg-card">
        <div className="landing-container flex flex-col items-start justify-between gap-8 py-14 sm:flex-row sm:items-center">
          <div>
            <p className="ui-eyebrow">Your next week starts here</p>
            <h2 id="access-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Make a plan. Show up.
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              TrainGrid is invite-only. If you’ve been invited, log in with Google or GitHub using that email address.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
              Not invited yet? Ask the person who shared TrainGrid with you to arrange an invitation, or <a href="https://iamtj.dev" target="_blank" rel="noopener noreferrer" className="underline-reveal text-accent">contact Tanuj through his portfolio</a>. Access is approved individually; there is no public sign-up.
            </p>
          </div>
          <Link
            href="/login"
            className={`${btnPrimary} shrink-0 gap-8 !px-5 !py-3`}
          >
            Log in to TrainGrid <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
