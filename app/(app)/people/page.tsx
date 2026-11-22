import Link from "next/link";
import { EmptyState, PeopleIcon, PeopleTabs } from "@/components/social/parts";
import { PeopleList, PersonRow } from "@/components/social/PersonRow";
import { SocialAvatar } from "@/components/social/SocialAvatar";
import { memberData } from "@/lib/data/server";
import { countIncomingRequests, getOwnSocialProfile, listNewestProfiles, searchProfiles } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { SEARCH_MAX, SEARCH_MIN } from "@/lib/social/model";
import { btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

export const metadata = socialMetadata("People");

/**
 * Find members by username or display name. Before a search it lists the
 * newest profiles. Only social profiles are listed (members opt in by
 * creating one), and an email address is never searched or shown.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, userId } = await memberData();
  const raw = (await searchParams).q;
  const query = typeof raw === "string" ? raw.trim().slice(0, SEARCH_MAX) : "";
  const searching = query.length > 0;
  const tooShort = searching && query.replace(/^@/, "").length < SEARCH_MIN;

  const [own, requests, people] = await Promise.all([
    getOwnSocialProfile(db, userId),
    countIncomingRequests(db, userId),
    searching ? searchProfiles(db, query) : listNewestProfiles(db, userId),
  ]);

  return (
    <div className="mx-auto w-[min(100%-1.5rem,52rem)] py-5 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-7">
        <div className="min-w-0">
          <p className="ui-eyebrow">People</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">Find your training people</h1>
          <p className="mt-1 text-sm leading-6 text-stone-600 sm:mt-2">TrainGrid members only. Follow to see their session updates in your feed.</p>
        </div>
        <PeopleTabs active="discover" requests={requests} />
      </header>

      <div className="mt-5 space-y-5 sm:mt-7">
        {own ? (
          <Link
            href={`/people/${own.username}`}
            className="ui-panel group flex items-center gap-3 p-3.5 hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 sm:p-4"
          >
            <SocialAvatar displayName={own.displayName} username={own.username} avatarUrl={own.avatarUrl} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold group-hover:underline">Your profile</span>
              <span className="block truncate text-xs text-stone-600">
                @{own.username} · {own.visibility === "private" ? "Private" : "Public to members"}
              </span>
            </span>
            <span aria-hidden="true" className="text-stone-400 group-hover:text-accent">→</span>
          </Link>
        ) : (
          <div className="ui-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-sm leading-6 text-stone-700">
              <span className="font-semibold">Set up your social profile</span> to follow people and share session updates. It starts private.
            </p>
            <Link href="/profile/social?next=/people" className={`${btnPrimary} shrink-0`}>
              Set up profile
            </Link>
          </div>
        )}

        <form role="search" action="/people" className="flex gap-2">
          <label htmlFor="people-search" className="sr-only">
            Search members by username or name
          </label>
          <input
            id="people-search"
            type="search"
            name="q"
            defaultValue={query}
            maxLength={SEARCH_MAX}
            placeholder="Search by @username or name"
            autoComplete="off"
            spellCheck={false}
            className={`${fieldClass} mt-0 flex-1`}
          />
          <button type="submit" className={btnSecondary}>
            Search
          </button>
        </form>

        <section aria-labelledby="people-results-title">
          <h2 id="people-results-title" className="mb-2 text-sm font-medium text-stone-700">
            {searching ? (tooShort ? "Keep typing" : `Results for “${query}”`) : "New on TrainGrid"}
          </h2>
          {tooShort ? (
            <p className="text-sm text-stone-600">Type at least {SEARCH_MIN} characters to search.</p>
          ) : people.length === 0 ? (
            <EmptyState
              testId="people-empty"
              icon={<PeopleIcon />}
              title={searching ? "Nobody by that name" : "No one else here yet"}
              actions={
                searching ? (
                  <Link href="/people" className={btnSecondary}>
                    Clear search
                  </Link>
                ) : undefined
              }
            >
              {searching
                ? "Check the spelling, or try part of a username. Members appear here once they set up a social profile."
                : "Members appear here once they set up a social profile."}
            </EmptyState>
          ) : (
            <PeopleList label={searching ? "Search results" : "New members"}>
              {people.map((person) => (
                <PersonRow
                  key={person.userId}
                  person={person}
                  detail={person.bio || undefined}
                />
              ))}
            </PeopleList>
          )}
        </section>
      </div>
    </div>
  );
}
