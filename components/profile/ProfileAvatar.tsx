/**
 * The member's initials in a copper-ringed disc. Decorative wherever the name
 * is also shown as text; the header link gives it its own label.
 */
export function ProfileAvatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const box =
    size === "lg"
      ? "size-16 text-xl sm:size-20 sm:text-2xl"
      : size === "md"
        ? "size-10 text-sm"
        : "size-8 text-xs";
  return (
    <span
      aria-hidden="true"
      className={`profile-avatar relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight ${box}`}
    >
      {initials}
    </span>
  );
}
