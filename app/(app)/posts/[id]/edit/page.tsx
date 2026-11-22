import Link from "next/link";
import { notFound } from "next/navigation";
import { PostComposer } from "@/components/social/PostComposer";
import { memberData } from "@/lib/data/server";
import { getOwnSocialProfile, getPost } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { getRequestToday } from "@/lib/today";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Edit post");

/** Edit the caption of one of your own posts. Anyone else's post is a 404. */
async function EditPostPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const post = await getPost(db, id);
  if (!post || post.author.userId !== userId) notFound();
  const own = await getOwnSocialProfile(db, userId);
  if (!own) notFound();
  const today = await getRequestToday();

  return (
    <div className="mx-auto w-[min(100%-1.5rem,64rem)] py-5 sm:py-10">
      <Link href={`/posts/${post.id}`} className="text-sm text-stone-600 hover:underline">
        ← Back to post
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Edit post</h1>
      <div className="mt-6">
        <PostComposer
          author={own}
          postId={post.id}
          session={post.session}
          initialCaption={post.caption}
          cancelHref={`/posts/${post.id}`}
          currentYear={Number(today.date.slice(0, 4))}
        />
      </div>
    </div>
  );
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function EditPostPage(props: Parameters<typeof EditPostPageContent>[0]) {
  return socialPage(() => EditPostPageContent(props));
}
