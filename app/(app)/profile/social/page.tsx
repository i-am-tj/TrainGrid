import Link from "next/link";
import { DeleteSocialProfile, SocialProfileForm } from "@/components/social/SocialProfileForm";
import { Notice } from "@/components/social/parts";
import { requireMember } from "@/lib/auth/session";
import { memberData } from "@/lib/data/server";
import { getOwnSocialProfile } from "@/lib/data/social";
import { socialMetadata } from "@/lib/social/metadata";
import { DISPLAY_NAME_MAX, safeAvatarUrl, safeReturnPath, suggestUsername } from "@/lib/social/model";

export const metadata = socialMetadata("Social profile");

/**
 * Create or edit your social profile: username, display name, bio, picture
 * and who can see your posts. A new profile is prefilled from your account
 * (a suggested username and your name) and starts Private.
 */
export default async function SocialProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember();
  const { db, userId } = await memberData();
  const query = await searchParams;
  const next = safeReturnPath(query.next, "");
  const [own, account] = await Promise.all([
    getOwnSocialProfile(db, userId),
    db.from("profiles").select("avatar_url").eq("id", userId).maybeSingle(),
  ]);
  const identityAvatarUrl = safeAvatarUrl(account.data?.avatar_url ?? null);
  const isNew = own === null;

  return (
    <div className="mx-auto w-[min(100%-1.5rem,44rem)] py-5 sm:py-10">
      <Link href={own ? `/people/${own.username}` : "/profile"} className="text-sm text-stone-600 hover:underline">
        ← {own ? "Your social profile" : "Profile"}
      </Link>
      <p className="ui-eyebrow mt-5">Social profile</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {isNew ? "Set up your social profile" : "Edit your social profile"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        {isNew
          ? "Choose how other TrainGrid members find you. Your profile starts private: you approve who sees your posts. Nothing from your plan is shared unless you post it."
          : "How other TrainGrid members see you. Your plan stays private either way."}
      </p>

      <div className="mt-5 space-y-5">
        {query.deleted === "1" ? <Notice tone="info">Your social profile, posts and connections were deleted.</Notice> : null}
        <section aria-label="Profile details" className="ui-panel p-5 sm:p-7">
          <SocialProfileForm
            isNew={isNew}
            next={next}
            identityAvatarUrl={identityAvatarUrl}
            initial={
              own
                ? {
                    username: own.username,
                    displayName: own.displayName,
                    bio: own.bio,
                    visibility: own.visibility,
                    useIdentityAvatar: own.useIdentityAvatar,
                  }
                : {
                    username: suggestUsername(member.displayName, member.email),
                    displayName: (member.displayName ?? "").trim().slice(0, DISPLAY_NAME_MAX),
                    bio: "",
                    visibility: "private",
                    useIdentityAvatar: false,
                  }
            }
          />
        </section>

        {own ? (
          <section aria-labelledby="leave-title" className="ui-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 id="leave-title" className="text-sm font-semibold">
                Leave the social side
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-stone-600">
                Deletes your username, posts and connections. Your plan, routines and workouts stay.
              </p>
            </div>
            <DeleteSocialProfile />
          </section>
        ) : null}
      </div>
    </div>
  );
}
