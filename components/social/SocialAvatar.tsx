import { safeAvatarUrl, socialInitials } from "@/lib/social/model";

const SIZES = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-2xl sm:size-24 sm:text-3xl",
} as const;

/**
 * A member's picture: their sign-in picture when they chose to show it,
 * otherwise their initials in TrainGrid's copper disc. The initials sit
 * underneath, so a picture that fails to load still leaves a face. Always
 * decorative: the name is next to it as text.
 */
export function SocialAvatar({
  displayName,
  username,
  avatarUrl,
  size = "md",
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  const src = safeAvatarUrl(avatarUrl);
  return (
    <span
      aria-hidden="true"
      className={`profile-avatar relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold tracking-tight ${SIZES[size]}`}
    >
      {socialInitials(displayName, username)}
      {src ? (
        // A remote picture from the member's sign-in provider; no referrer is sent.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
