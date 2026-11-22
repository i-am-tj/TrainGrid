import Link from "next/link";
import type { ReactNode } from "react";
import { LockIcon } from "./parts";
import { SocialAvatar } from "./SocialAvatar";

/**
 * One member in a list (search results, followers, requests): picture, name,
 * @username, an optional line, and actions at the end. The whole name links
 * to their profile; actions stay separate buttons, so each is its own stop
 * for the keyboard.
 */
export function PersonRow({
  person,
  detail,
  actions,
}: {
  person: { username: string; displayName: string; avatarUrl: string | null; visibility: "public" | "private" };
  detail?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li data-testid="person-row" className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
      <Link
        href={`/people/${person.username}`}
        className={`group flex min-w-0 flex-1 items-center gap-3 rounded-lg ${actions ? "max-sm:basis-full" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2`}
      >
        <SocialAvatar displayName={person.displayName} username={person.username} avatarUrl={person.avatarUrl} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate group-hover:underline">{person.displayName}</span>
            {person.visibility === "private" ? (
              <span className="text-stone-500" title="Private profile">
                <LockIcon />
                <span className="sr-only">(private profile)</span>
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-stone-600">@{person.username}</span>
          {detail ? <span className="mt-0.5 block text-xs leading-5 text-stone-600 [overflow-wrap:anywhere]">{detail}</span> : null}
        </span>
      </Link>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:ml-12">{actions}</div> : null}
    </li>
  );
}

/** A bordered list of PersonRows. */
export function PeopleList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="ui-panel divide-y divide-line overflow-hidden">
      {children}
    </ul>
  );
}
