import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/social/PostCard";
import { Notice } from "@/components/social/parts";
import { memberData } from "@/lib/data/server";
import { getPost } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Post");

/**
 * One post. The link is safe to pass around between members: it carries a
 * post id, never a session id, and the database shows it only to members
 * who may see the author's posts. Everyone else gets a plain 404.
 */
async function PostPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const saved = (await searchParams).saved === "1";
  const post = await getPost(db, id);
  if (!post) notFound();

  return (
    <div className="mx-auto w-[min(100%-1.5rem,44rem)] py-5 sm:py-10">
      <Link href="/feed" className="text-sm text-stone-600 hover:underline">
        ← Back to feed
      </Link>
      <h1 className="sr-only">Post by {post.author.displayName}</h1>
      <div className="mt-4 space-y-4">
        {saved ? <Notice>Saved.</Notice> : null}
        <PostCard post={post} isOwn={post.author.userId === userId} returnTo={`/people/${post.author.username}`} />
        <p className="text-center text-sm">
          <Link href={`/people/${post.author.username}`} className="text-accent underline underline-offset-4">
            More from @{post.author.username}
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function PostPage(props: Parameters<typeof PostPageContent>[0]) {
  return socialPage(() => PostPageContent(props));
}
