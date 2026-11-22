import { ConnectionsView } from "@/components/social/ConnectionsView";
import { socialMetadata } from "@/lib/social/metadata";

export const metadata = socialMetadata("Followers");

export default async function FollowersPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  return <ConnectionsView username={username} kind="followers" rawPage={(await searchParams).page} />;
}
