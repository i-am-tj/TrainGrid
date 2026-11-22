import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionType } from "@/lib/domain";
import { summaryParts, type SessionSummary, type Visibility } from "@/lib/social/model";
import { TYPE_BAR, TYPE_TINT } from "@/lib/ui";

/** Small shared pieces of the social pages. */

export function LockIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="9" width="11" height="8" rx="2" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}

export function GlobeIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2 2.2 2.8 4.5 2.8 7s-.8 4.8-2.8 7c-2-2.2-2.8-4.5-2.8-7S8 5.2 10 3z" />
    </svg>
  );
}

/** "Private" or "Public members", with an icon; the words carry the meaning. */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-line bg-card/70 px-2 text-[11px] font-medium text-stone-700">
      {visibility === "private" ? <LockIcon /> : <GlobeIcon />}
      {visibility === "private" ? "Private" : "Public to members"}
    </span>
  );
}

/**
 * The session summary a post shares: its name and the chosen facts, on the
 * category's colour bar. Exactly what other members see.
 */
export function SessionSummaryBlock({
  session,
  currentYear,
  label = "Session",
}: {
  session: SessionSummary;
  currentYear?: number;
  label?: string;
}) {
  const category = session.category as SessionType;
  return (
    <div
      className={`rounded-xl border border-line border-l-4 px-3.5 py-3 ${TYPE_BAR[category] ?? TYPE_BAR.other} ${TYPE_TINT[category] ?? TYPE_TINT.other}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600">{label}</p>
      <p className="mt-0.5 text-base font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">{session.name}</p>
      <p className="mt-1 text-sm text-stone-700">
        {summaryParts(session, currentYear).map((part, index) => (
          <span key={part}>
            {index > 0 ? <span aria-hidden="true" className="px-1.5 text-stone-400">·</span> : null}
            {part}
          </span>
        ))}
      </p>
    </div>
  );
}

/** A calm, centred empty state with optional actions. */
export function EmptyState({
  title,
  children,
  actions,
  icon,
  testId,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="ui-panel flex flex-col items-center px-5 py-10 text-center sm:px-10 sm:py-14">
      {icon ? (
        <span aria-hidden="true" className="profile-avatar inline-flex size-12 items-center justify-center rounded-full">
          {icon}
        </span>
      ) : null}
      <h2 className={`${icon ? "mt-4" : ""} text-lg font-semibold tracking-tight`}>{title}</h2>
      {children ? <div className="mt-2 max-w-md text-sm leading-6 text-stone-600">{children}</div> : null}
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A one-line confirmation after an action, announced politely. */
export function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "info" }) {
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-line bg-card text-stone-700"
      }`}
    >
      {tone === "success" ? (
        <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      ) : null}
      <span>{children}</span>
    </p>
  );
}

/** Discover / Requests tabs at the top of the People pages. */
export function PeopleTabs({ active, requests }: { active: "discover" | "requests"; requests: number }) {
  const tab = (id: "discover" | "requests", href: string, label: ReactNode) => (
    <Link
      href={href}
      aria-current={active === id ? "page" : undefined}
      className={`ui-control inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
        active === id ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-100"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="People" className="inline-flex gap-1 rounded-full border border-line bg-card p-1">
      {tab("discover", "/people", "Discover")}
      {tab(
        "requests",
        "/people/requests",
        <>
          Requests
          {requests > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-white">
              <span className="sr-only">, </span>
              {requests > 99 ? "99+" : requests}
              <span className="sr-only"> waiting</span>
            </span>
          ) : null}
        </>,
      )}
    </nav>
  );
}

export function PeopleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M16.5 14.6c2.4.2 4.2 1.7 4.9 4.4" />
    </svg>
  );
}

export function FeedIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </svg>
  );
}
