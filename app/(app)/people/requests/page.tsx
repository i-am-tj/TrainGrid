import Link from "next/link";
import { ActionButton, ConfirmActionButton } from "@/components/social/ActionButtons";
import { EmptyState, PeopleTabs } from "@/components/social/parts";
import { PeopleList, PersonRow } from "@/components/social/PersonRow";
import { memberData } from "@/lib/data/server";
import { getOwnSocialProfile, listFollowRequests } from "@/lib/data/social";
import { acceptRequestAction, rejectRequestAction, unfollowAction } from "@/lib/social/actions";
import { socialMetadata } from "@/lib/social/metadata";
import { timeAgo } from "@/lib/social/model";
import { btnDanger, btnPrimary, btnSecondaryCompact } from "@/lib/ui";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Follow requests");

const compactPrimary = btnPrimary.replace("min-h-10", "min-h-8").replace("px-3 py-2 text-sm", "px-2.5 py-1 text-xs");

/** Requests to follow you (approve or decline), and your own waiting requests (cancel). */
async function RequestsPageContent() {
  const { db, userId } = await memberData();
  const own = await getOwnSocialProfile(db, userId);
  const { incoming, outgoing } = own ? await listFollowRequests(db, userId) : { incoming: [], outgoing: [] };
  const now = new Date();

  return (
    <div className="mx-auto w-[min(100%-1.5rem,52rem)] py-5 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-7">
        <div className="min-w-0">
          <p className="ui-eyebrow">People</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">Follow requests</h1>
          <p className="mt-1 text-sm leading-6 text-stone-600 sm:mt-2">
            Approved followers see your posts and lists while your profile is private.
          </p>
        </div>
        <PeopleTabs active="requests" requests={incoming.length} />
      </header>

      {!own ? (
        <div className="mt-5 sm:mt-7">
          <EmptyState
            title="No social profile yet"
            actions={
              <Link href="/profile/social?next=/people/requests" className={btnPrimary}>
                Set up profile
              </Link>
            }
          >
            Requests arrive once you have a profile people can find.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-5 space-y-8 sm:mt-7">
          <section aria-labelledby="incoming-title">
            <h2 id="incoming-title" className="mb-2 text-sm font-medium text-stone-700">
              Waiting for you {incoming.length > 0 ? `(${incoming.length})` : ""}
            </h2>
            {incoming.length === 0 ? (
              <EmptyState testId="requests-empty" title="No requests right now">
                {own.visibility === "private"
                  ? "When someone asks to follow you, they’ll appear here for you to approve or decline."
                  : "Your profile is public, so members can follow you without asking."}
              </EmptyState>
            ) : (
              <PeopleList label="Requests to follow you">
                {incoming.map((person) => (
                  <PersonRow
                    key={person.userId}
                    person={person}
                    detail={person.since ? `Asked ${timeAgo(person.since, now)}` : undefined}
                    actions={
                      <>
                        <ActionButton
                          action={acceptRequestAction}
                          userId={person.userId}
                          label="Approve"
                          busy="Approving…"
                          ariaLabel={`Approve ${person.displayName}`}
                          className={compactPrimary}
                        />
                        <ActionButton
                          action={rejectRequestAction}
                          userId={person.userId}
                          label="Decline"
                          busy="Declining…"
                          ariaLabel={`Decline ${person.displayName}`}
                          className={btnSecondaryCompact}
                        />
                      </>
                    }
                  />
                ))}
              </PeopleList>
            )}
          </section>

          <section aria-labelledby="outgoing-title">
            <h2 id="outgoing-title" className="mb-2 text-sm font-medium text-stone-700">
              Sent by you {outgoing.length > 0 ? `(${outgoing.length})` : ""}
            </h2>
            {outgoing.length === 0 ? (
              <p className="text-sm text-stone-600">
                No requests waiting. <Link href="/people" className="text-accent underline underline-offset-4">Find people</Link> to follow.
              </p>
            ) : (
              <PeopleList label="Your waiting requests">
                {outgoing.map((person) => (
                  <PersonRow
                    key={person.userId}
                    person={person}
                    detail={person.since ? `Requested ${timeAgo(person.since, now)}` : undefined}
                    actions={
                      <ConfirmActionButton
                        action={unfollowAction}
                        userId={person.userId}
                        label="Cancel request"
                        ariaLabel={`Cancel request to ${person.displayName}`}
                        title="Cancel your request?"
                        description={`${person.displayName} won’t see your request any more. You can ask again later.`}
                        confirm="Cancel request"
                        busy="Cancelling…"
                        className={btnSecondaryCompact}
                        confirmClassName={btnDanger}
                      />
                    }
                  />
                ))}
              </PeopleList>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function RequestsPage() {
  return socialPage(() => RequestsPageContent());
}
