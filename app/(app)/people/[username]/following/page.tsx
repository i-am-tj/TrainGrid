import { ConnectionsView } from "@/components/social/ConnectionsView";
import { socialMetadata } from "@/lib/social/metadata";

export const metadata = socialMetadata("Following");

export default async function FollowingPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  return <ConnectionsView username={username} kind="following" rawPage={(await searchParams).page} />;
}
