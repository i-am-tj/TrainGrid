import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostComposer } from "@/components/social/PostComposer";
import { memberData } from "@/lib/data/server";
import { getSession } from "@/lib/data/sessions";
import { getOwnSocialProfile } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { getRequestToday } from "@/lib/today";
import { socialPage } from "@/components/social/SocialUnavailable";

export const metadata = socialMetadata("Post an update");

/**
 * The composer for one of the member's own sessions. The session is read as
 * the member (RLS), so someone else's session id is simply not found. The
 * post's summary is copied by the database from this session on publish.
 */
async function PostSessionPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { db, userId } = await memberData();
  const { id } = await params;
  const session = await getSession(db, userId, id);
  if (!session) notFound();
  const own = await getOwnSocialProfile(db, userId);
  if (!own) redirect(`/profile/social?next=${encodeURIComponent(`/session/${session.id}/post`)}`);
  const today = await getRequestToday();

  return (
    <div className="mx-auto w-[min(100%-1.5rem,64rem)] py-5 sm:py-10">
      <Link href={`/session/${session.id}`} className="text-sm text-stone-600 hover:underline">
        ← Back to session
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Post an update</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
        Share a note about this session with {own.visibility === "private" ? "your approved followers" : "TrainGrid members"}.
        Review the preview: it’s exactly what they’ll see.
      </p>
      <div className="mt-6">
        <PostComposer
          author={own}
          sessionId={session.id}
          session={{
            name: session.name,
            category: session.category,
            date: session.date,
            durationMinutes: session.durationMinutes,
          }}
          cancelHref={`/session/${session.id}`}
          currentYear={Number(today.date.slice(0, 4))}
        />
      </div>
    </div>
  );
}

/** Shows the "not available yet" panel instead of failing if the social schema is missing. */
export default async function PostSessionPage(props: Parameters<typeof PostSessionPageContent>[0]) {
  return socialPage(() => PostSessionPageContent(props));
}
