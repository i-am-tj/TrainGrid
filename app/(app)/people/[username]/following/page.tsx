import { ConnectionsView } from "@/components/social/ConnectionsView";
import { socialMetadata } from "@/lib/social/metadata";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Following");

async function FollowingPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  return <ConnectionsView username={username} kind="following" rawPage={(await searchParams).page} />;
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function FollowingPage(props: Parameters<typeof FollowingPageContent>[0]) {
  return socialPage(() => FollowingPageContent(props));
}
