import Link from "next/link";
import { followAction, unfollowAction } from "@/lib/social/actions";
import { followLabel, type FollowStatus, type Visibility } from "@/lib/social/model";
import { btnDanger, btnPrimary, btnSecondary } from "@/lib/ui";
import { ActionButton, ConfirmActionButton } from "./ActionButtons";

/**
 * The follow button for someone else's profile, for every relationship:
 * Follow (public) or Request to follow (private); Requested, which cancels;
 * Following, which unfollows. Members without a social profile of their own
 * are pointed at setting one up first.
 */
export function FollowControls({
  userId,
  username,
  displayName,
  visibility,
  viewerFollow,
  followsViewer,
  viewerHasProfile,
}: {
  userId: string;
  username: string;
  displayName: string;
  visibility: Visibility;
  viewerFollow: FollowStatus | null;
  followsViewer: FollowStatus | null;
  viewerHasProfile: boolean;
}) {
  if (!viewerHasProfile) {
    return (
      <Link href={`/profile/social?next=${encodeURIComponent(`/people/${username}`)}`} className={btnSecondary}>
        Set up your profile to follow
      </Link>
    );
  }

  const label = followLabel({ visibility, viewerFollow, followsViewer });
  if (viewerFollow === "accepted") {
    return (
      <ConfirmActionButton
        action={unfollowAction}
        userId={userId}
        label={label}
        ariaLabel={`Following ${displayName}. Unfollow`}
        title={`Unfollow ${displayName}?`}
        description={
          visibility === "private"
            ? "Their profile is private: to see their posts again you’ll need to send a new request."
            : "Their posts will leave your feed. You can follow again at any time."
        }
        confirm="Unfollow"
        busy="Unfollowing…"
        className={btnSecondary}
        confirmClassName={btnDanger}
        testId="follow-button"
      />
    );
  }
  if (viewerFollow === "pending") {
    return (
      <ConfirmActionButton
        action={unfollowAction}
        userId={userId}
        label={label}
        ariaLabel={`Request sent to ${displayName}. Cancel request`}
        title="Cancel your request?"
        description={`${displayName} won’t see your request any more. You can ask again later.`}
        confirm="Cancel request"
        busy="Cancelling…"
        className={btnSecondary}
        confirmClassName={btnDanger}
        testId="follow-button"
      />
    );
  }
  return (
    <ActionButton
      action={followAction}
      userId={userId}
      label={label}
      ariaLabel={`${label}: ${displayName}`}
      busy={visibility === "private" ? "Sending…" : "Following…"}
      className={btnPrimary}
      testId="follow-button"
    />
  );
}
