import { countPendingInviteRequests } from "@/lib/admin/invite-requests";

/**
 * The number of invite requests waiting for review, as a small accent badge
 * at the top right of the admin's Invitations link. Streams in on its own
 * (the header never waits for it) and renders nothing at zero, or when the
 * count is unknown (the Invitations page then says the list is unavailable). The badge is
 * decorative; screen readers hear the count through the link's description.
 */
export async function PendingRequestsBadge({ descriptionId }: { descriptionId: string }) {
  const count = await countPendingInviteRequests();
  // The description element always exists, so the link's aria-describedby never dangles.
  if (count === null || count === 0) return <span id={descriptionId} className="sr-only" />;
  const label = count > 99 ? "99+" : String(count);
  return (
    <>
      <span
        aria-hidden="true"
        data-testid="pending-requests-badge"
        className="absolute -right-3.5 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white tabular-nums ring-2 ring-card"
      >
        {label}
      </span>
      <span id={descriptionId} className="sr-only">
        {count === 1 ? "1 request to review" : `${count} requests to review`}
      </span>
    </>
  );
}
