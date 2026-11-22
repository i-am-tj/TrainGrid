import { ConnectionsView } from "@/components/social/ConnectionsView";
import { socialMetadata } from "@/lib/social/metadata";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Followers");

async function FollowersPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  return <ConnectionsView username={username} kind="followers" rawPage={(await searchParams).page} />;
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function FollowersPage(props: Parameters<typeof FollowersPageContent>[0]) {
  return socialPage(() => FollowersPageContent(props));
}
