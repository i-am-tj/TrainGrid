import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AppearanceChoice } from "@/components/profile/AppearanceChoice";
import { DeviceTimeZone } from "@/components/profile/DeviceTimeZone";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { isAdminViewer, parseAdminUserIds } from "@/lib/admin/access";
import { requireMember } from "@/lib/auth/session";
import { displayVersion, isRecentRelease } from "@/lib/changelog";
import { loadReleases } from "@/lib/changelog-file";
import { getProfileSummary } from "@/lib/data/profile";
import { memberData } from "@/lib/data/server";
import { getOwnSocialProfile } from "@/lib/data/social";
import { initialsFor, memberSince, plural, profileName } from "@/lib/profile/model";
import { contactEmail } from "@/lib/site";
import { getRequestToday } from "@/lib/today";
import { btnSecondaryCompact } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Profile · TrainGrid",
  robots: { index: false, follow: false },
};

/**
 * The member's profile: who they are signed in as, their plan in numbers,
 * their data and appearance, and everything about TrainGrid itself (What's
 * new, privacy notice, terms). Members only; every read runs as the member.
 */
export default async function ProfilePage() {
  const member = await requireMember();
  const { db, userId } = await memberData();
  const today = await getRequestToday();
  const [latest] = await loadReleases();
  const summary = getProfileSummary(db, userId, today.date).catch(() => null);
  const social = await getOwnSocialProfile(db, userId).catch(() => null);
  const isAdmin = isAdminViewer(member, parseAdminUserIds(process.env.TRAINGRID_ADMIN_USER_IDS));
  const name = profileName(member.displayName, member.email);
  const contact = contactEmail();
  const fresh = latest ? isRecentRelease(latest, today.date) : false;

  return (
    <div className="mx-auto w-[min(100%-1.5rem,64rem)] py-5 sm:py-12">
      <section
        aria-labelledby="profile-title"
        className="ui-panel profile-hero relative overflow-hidden p-5 sm:p-8"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 size-64 rounded-full bg-accent/5 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <ProfileAvatar initials={initialsFor(member.displayName, member.email)} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="ui-eyebrow">Your profile</p>
            <h1
              id="profile-title"
              className="mt-2 text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl"
            >
              {name}
            </h1>
            {member.email ? (
              <p className="mt-1 text-sm text-stone-600 [overflow-wrap:anywhere]">{member.email}</p>
            ) : null}
            <ul aria-label="Membership" className="mt-4 flex flex-wrap gap-2">
              <Chip>Early access member</Chip>
              {isAdmin ? <Chip accent>Admin</Chip> : null}
              <Suspense fallback={null}>
                <MemberSinceChip summary={summary} />
              </Suspense>
            </ul>
          </div>
        </div>

        <Suspense fallback={<StatsSkeleton />}>
          <Stats summary={summary} />
        </Suspense>
      </section>

      <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-2">
        <Card id="account" title="Account" description="Everything you plan in TrainGrid is yours.">
          <Row
            title="Social profile"
            detail={
              social
                ? `@${social.username} · ${social.visibility === "private" ? "Private: you approve followers" : "Public to TrainGrid members"}`
                : "Not set up. Choose a username to follow people and share updates."
            }
            icon={<PeopleIcon />}
            href="/profile/social"
          />
          <Row
            title="Download my data"
            detail="Everything you’ve added, as one JSON file: routines, sessions, workouts and your social activity."
            icon={<DownloadIcon />}
            href="/api/export"
            download
            className="border-t border-line"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-background text-stone-600"
              >
                <ExitIcon />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Sign out</p>
                <p className="mt-0.5 text-xs leading-5 text-stone-600">On this device. Your plan stays safe.</p>
              </div>
            </div>
            <SignOutButton className={`${btnSecondaryCompact} disabled:opacity-60`} />
          </div>
        </Card>

        <Card id="preferences" title="Preferences" description="How TrainGrid looks and keeps time for you.">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Appearance</p>
              <p className="mt-0.5 text-xs leading-5 text-stone-600">On this device.</p>
            </div>
            <AppearanceChoice />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Time zone</p>
              <p className="mt-0.5 text-xs leading-5 text-stone-600">“Today” follows your device’s clock.</p>
            </div>
            <DeviceTimeZone serverTimeZone={today.timeZone} />
          </div>
        </Card>

        <Card
          id="about"
          title="About TrainGrid"
          description="Release notes, and how your information is looked after."
          className="md:col-span-2"
        >
          <div className="grid md:grid-cols-3 md:divide-x md:divide-line">
            <Row
              title="What’s new"
              detail={latest ? `TrainGrid ${displayVersion(latest.version)}, and every release before it.` : "Every release, newest first."}
              icon={<SparkIcon />}
              href="/whats-new"
              badge={fresh ? "New" : undefined}
            />
            <Row
              title="Privacy notice"
              detail="What’s stored, why, and your choices."
              icon={<ShieldIcon />}
              href="/privacy"
              className="border-t border-line md:border-t-0"
            />
            <Row
              title="Terms of use"
              detail="The short, plain terms for early access."
              icon={<DocIcon />}
              href="/terms"
              className="border-t border-line md:border-t-0"
            />
          </div>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs leading-6 text-stone-600 sm:mt-8">
        {latest ? <>TrainGrid {latest.version} · </> : null}
        {contact ? (
          <>
            Need a hand?{" "}
            <a href={`mailto:${contact}`} className="underline-reveal text-accent">
              {contact}
            </a>
          </>
        ) : (
          "Thanks for helping shape TrainGrid."
        )}
      </p>
    </div>
  );
}

type SummaryRead = Promise<Awaited<ReturnType<typeof getProfileSummary>> | null>;

async function MemberSinceChip({ summary }: { summary: SummaryRead }) {
  const since = memberSince((await summary)?.createdAt ?? null);
  return since ? <Chip>Member since {since}</Chip> : null;
}

async function Stats({ summary }: { summary: SummaryRead }) {
  const value = await summary;
  if (!value) {
    return (
      <p className="relative mt-6 border-t border-line pt-5 text-sm text-stone-600">
        Your numbers aren’t available right now. Your plan is safe.
      </p>
    );
  }
  const stats = [
    { label: "Planned", value: value.sessions, hint: plural(value.sessions, "session"), href: "/week/current" },
    { label: "Coming up", value: value.upcoming, hint: `${plural(value.upcoming, "session")} from today`, href: "/week/current" },
    { label: "Routines", value: value.routines, hint: plural(value.routines, "routine"), href: "/library?scope=mine" },
  ];
  return (
    <dl className="relative mt-6 grid grid-cols-3 gap-2 border-t border-line pt-5 sm:gap-4" data-testid="profile-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600 sm:text-xs">{stat.label}</dt>
          <dd className="mt-1">
            <Link
              href={stat.href}
              aria-label={`${stat.label}: ${stat.hint}`}
              className="profile-stat inline-block rounded-md text-3xl font-semibold tabular-nums tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 sm:text-4xl"
            >
              {stat.value.toLocaleString("en-AU")}
            </Link>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StatsSkeleton() {
  return (
    <div aria-hidden="true" className="relative mt-6 grid grid-cols-3 gap-2 border-t border-line pt-5 sm:gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="h-3 w-20 rounded bg-stone-200 motion-safe:animate-pulse" />
          <div className="mt-2 h-8 w-10 rounded bg-stone-200 motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Chip({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <li
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-medium ${
        accent ? "border-accent/40 bg-accent/10 text-accent" : "border-line bg-card/70 text-stone-700"
      }`}
    >
      {children}
    </li>
  );
}

function Card({
  id,
  title,
  description,
  className = "",
  children,
}: {
  id: string;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={`ui-panel overflow-hidden ${className}`}>
      <header className="px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-stone-600">{description}</p>
      </header>
      <div className="border-t border-line">{children}</div>
    </section>
  );
}

function Row({
  title,
  detail,
  icon,
  href,
  badge,
  download = false,
  className = "",
}: {
  title: string;
  detail: string;
  icon: ReactNode;
  href: string;
  badge?: string;
  download?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-background text-accent transition-colors duration-200 group-hover:border-accent/50 motion-reduce:transition-none"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="underline-reveal">{title}</span>
          {badge ? (
            <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-white">{badge}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-stone-600">{detail}</span>
      </span>
      <span
        aria-hidden="true"
        className="text-stone-400 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transition-none"
      >
        {download ? "↓" : "→"}
      </span>
    </>
  );
  const classes = `underline-reveal-parent group flex min-h-16 items-center gap-3 px-4 py-3.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-900 sm:px-5 ${className}`;
  // A file download is a plain link; pages use client navigation.
  return download ? (
    <a href={href} className={classes}>
      {body}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {body}
    </Link>
  );
}

const iconProps = {
  viewBox: "0 0 20 20",
  className: "size-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ExitIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 3.5H4.5v13H8M12.5 6.5L16 10l-3.5 3.5M16 10H8" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="7.5" cy="7" r="2.8" />
      <path d="M2.5 16c.6-2.8 2.6-4.2 5-4.2s4.4 1.4 5 4.2M13.5 4.6a2.4 2.4 0 0 1 0 4.6M15 11.9c1.4.5 2.3 1.8 2.6 4.1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6L10 2.5zM15.5 13.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 2.5l6 2.3v4.6c0 3.6-2.5 6.6-6 8.1-3.5-1.5-6-4.5-6-8.1V4.8l6-2.3z" />
      <path d="M7.5 10l1.8 1.8 3.4-3.6" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5.5 2.5h6l3 3v12h-9v-15z" />
      <path d="M11.5 2.5v3h3M8 10h4.5M8 13h4.5" />
    </svg>
  );
}
