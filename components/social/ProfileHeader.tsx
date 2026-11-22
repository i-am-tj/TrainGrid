import Link from "next/link";
import { acceptRequestAction, rejectRequestAction } from "@/lib/social/actions";
import { memberSince, plural } from "@/lib/profile/model";
import type { ProfileCard } from "@/lib/social/model";
import { btnPrimary, btnSecondary, btnSecondaryCompact } from "@/lib/ui";
import { ActionButton } from "./ActionButtons";
import { FollowControls } from "./FollowControls";
import { VisibilityBadge } from "./parts";
import { SocialAvatar } from "./SocialAvatar";

/**
 * The top of a member's profile: who they are, their counts, and what the
 * viewer can do (follow, cancel, unfollow; approve their request; or, on
 * their own profile, edit it and post). Counts link to the lists, which say
 * themselves when they are private.
 */
export function ProfileHeader({ card, viewerHasProfile }: { card: ProfileCard; viewerHasProfile: boolean }) {
  const since = memberSince(card.createdAt);
  const base = `/people/${card.username}`;
  const stats = [
    { label: "Posts", value: card.postCount, hint: plural(card.postCount, "post"), href: null },
    { label: "Followers", value: card.followerCount, hint: plural(card.followerCount, "follower"), href: `${base}/followers` },
    { label: "Following", value: card.followingCount, hint: `following ${plural(card.followingCount, "member")}`, href: `${base}/following` },
  ];

  return (
    <section aria-labelledby="profile-name" className="ui-panel profile-hero relative overflow-hidden p-5 sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 size-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <SocialAvatar displayName={card.displayName} username={card.username} avatarUrl={card.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 id="profile-name" className="text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
            {card.displayName}
          </h1>
          <p className="mt-0.5 text-sm text-stone-600 [overflow-wrap:anywhere]">@{card.username}</p>
          {card.bio ? <p className="mt-3 max-w-xl text-sm leading-6 text-stone-800 [overflow-wrap:anywhere]">{card.bio}</p> : null}
          <ul aria-label="About this profile" className="mt-3 flex flex-wrap items-center gap-2">
            <li>
              <VisibilityBadge visibility={card.visibility} />
            </li>
            {card.followsViewer === "accepted" && !card.isSelf ? (
              <li className="inline-flex min-h-6 items-center rounded-full bg-stone-100 px-2 text-[11px] font-medium text-stone-700">
                Follows you
              </li>
            ) : null}
            {since ? <li className="text-xs text-stone-600">On TrainGrid since {since}</li> : null}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {card.isSelf ? (
            <>
              <Link href="/profile/social" className={btnSecondary}>
                Edit profile
              </Link>
              <Link href="/feed/new" className={btnPrimary}>
                Post an update
              </Link>
            </>
          ) : (
            <FollowControls
              userId={card.userId}
              username={card.username}
              displayName={card.displayName}
              visibility={card.visibility}
              viewerFollow={card.viewerFollow}
              followsViewer={card.followsViewer}
              viewerHasProfile={viewerHasProfile}
            />
          )}
        </div>
      </div>

      {card.followsViewer === "pending" && !card.isSelf ? (
        <div
          role="region"
          aria-label="Follow request"
          className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3"
        >
          <p className="text-sm">
            <span className="font-semibold">{card.displayName}</span> asked to follow you.
          </p>
          <div className="flex gap-2">
            <ActionButton
              action={acceptRequestAction}
              userId={card.userId}
              label="Approve"
              busy="Approving…"
              className={btnPrimary.replace("min-h-10", "min-h-8").replace("px-3 py-2 text-sm", "px-2.5 py-1 text-xs")}
            />
            <ActionButton action={rejectRequestAction} userId={card.userId} label="Decline" busy="Declining…" className={btnSecondaryCompact} />
          </div>
        </div>
      ) : null}

      <dl className="relative mt-6 grid grid-cols-3 gap-2 border-t border-line pt-5 sm:gap-4" data-testid="social-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600 sm:text-xs">{stat.label}</dt>
            <dd className="mt-1">
              {stat.href ? (
                <Link
                  href={stat.href}
                  aria-label={`${stat.label}: ${stat.hint}`}
                  className="profile-stat inline-block rounded-md text-2xl font-semibold tabular-nums tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 sm:text-3xl"
                >
                  {stat.value.toLocaleString("en-AU")}
                </Link>
              ) : (
                <span className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{stat.value.toLocaleString("en-AU")}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
