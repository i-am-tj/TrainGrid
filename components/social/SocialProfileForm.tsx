"use client";

import { useActionState, useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { deleteSocialProfileAction, saveSocialProfileAction } from "@/lib/social/actions";
import { IDLE } from "@/lib/social/form-state";
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  USERNAME_MAX,
  normaliseUsername,
  usernameProblem,
  type Visibility,
} from "@/lib/social/model";
import { btnDanger, btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";
import { GlobeIcon, LockIcon } from "./parts";
import { SocialAvatar } from "./SocialAvatar";

export type ProfileFormValues = {
  username: string;
  displayName: string;
  bio: string;
  visibility: Visibility;
  useIdentityAvatar: boolean;
};

/**
 * Create or edit the member's social profile. Checks the username as it is
 * typed (the server checks again, and the database has the final word on
 * uniqueness), previews the picture, and explains each visibility in plain
 * words. New profiles start Private.
 */
export function SocialProfileForm({
  initial,
  isNew,
  identityAvatarUrl,
  next,
}: {
  initial: ProfileFormValues;
  isNew: boolean;
  /** The member's sign-in picture, if they have one. */
  identityAvatarUrl: string | null;
  next: string;
}) {
  const [state, action, pending] = useActionState(saveSocialProfileAction, IDLE);
  const [username, setUsername] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [useAvatar, setUseAvatar] = useState(initial.useIdentityAvatar && identityAvatarUrl !== null);
  const [touched, setTouched] = useState(false);
  const ids = { username: useId(), usernameHint: useId(), name: useId(), bio: useId(), bioHint: useId(), error: useId() };

  const normalised = normaliseUsername(username);
  const problem = normalised ? usernameProblem(normalised) : "Choose a username.";
  const showProblem = touched && problem;
  const goingPrivate = !isNew && initial.visibility === "public" && visibility === "private";

  return (
    <form action={action} noValidate aria-describedby={state.status === "error" ? ids.error : undefined} className="space-y-6">
      <input type="hidden" name="next" value={next} />

      <div className="flex items-center gap-4">
        <SocialAvatar displayName={displayName || "?"} username={normalised || "?"} avatarUrl={useAvatar ? identityAvatarUrl : null} size="lg" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Profile picture</p>
          {identityAvatarUrl ? (
            <>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  name="useIdentityAvatar"
                  checked={useAvatar}
                  onChange={(event) => setUseAvatar(event.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--accent)]"
                />
                <span>Use my Google or GitHub picture</span>
              </label>
              <p className="mt-1 text-xs leading-5 text-stone-600">Otherwise, your initials.</p>
            </>
          ) : (
            <p className="mt-1 text-xs leading-5 text-stone-600">
              Your initials are shown: your sign-in account has no picture to use.
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={ids.username} className="text-sm font-medium">
          Username
        </label>
        <div className="relative mt-1">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-500">
            @
          </span>
          <input
            id={ids.username}
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onBlur={() => setTouched(true)}
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={USERNAME_MAX + 1}
            aria-invalid={showProblem ? true : undefined}
            aria-describedby={ids.usernameHint}
            className={`${fieldClass} mt-0 pl-7`}
          />
        </div>
        <p id={ids.usernameHint} className={`mt-1.5 text-xs leading-5 ${showProblem ? "text-red-800" : "text-stone-600"}`}>
          {showProblem
            ? problem
            : `3–${USERNAME_MAX} letters, numbers or underscores. Your profile lives at /people/${normalised || "username"}.`}
        </p>
      </div>

      <div>
        <label htmlFor={ids.name} className="text-sm font-medium">
          Display name
        </label>
        <input
          id={ids.name}
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor={ids.bio} className="text-sm font-medium">
          Bio <span className="font-normal text-stone-600">(optional)</span>
        </label>
        <textarea
          id={ids.bio}
          name="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={2}
          maxLength={BIO_MAX}
          aria-describedby={ids.bioHint}
          placeholder="Marathon in March. Lifting twice a week."
          className={`${fieldClass} resize-none`}
        />
        <p id={ids.bioHint} className="mt-1 text-right text-xs tabular-nums text-stone-600">
          {bio.length}/{BIO_MAX}
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Who can see your posts</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <VisibilityOption
            value="private"
            checked={visibility === "private"}
            onChange={setVisibility}
            icon={<LockIcon className="size-4" />}
            title="Private"
            detail="Members see your name and bio. Only followers you approve see your posts and lists."
          />
          <VisibilityOption
            value="public"
            checked={visibility === "public"}
            onChange={setVisibility}
            icon={<GlobeIcon className="size-4" />}
            title="Public to members"
            detail="Any signed-in TrainGrid member can follow you and see your posts. Never the open internet."
          />
        </div>
        {goingPrivate ? (
          <p role="status" className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-700">
            Your posts will be visible only to the people who already follow you. New followers will need your approval.
          </p>
        ) : null}
      </fieldset>

      {state.status === "error" ? (
        <p id={ids.error} role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <button
          type="submit"
          className={btnPrimary}
          disabled={pending}
          aria-busy={pending}
          onClick={() => setTouched(true)}
        >
          {pending ? "Saving…" : isNew ? "Create profile" : "Save profile"}
        </button>
        <p className="text-xs leading-5 text-stone-600">
          Your email address is never shown to other members.
        </p>
      </div>
    </form>
  );
}

function VisibilityOption({
  value,
  checked,
  onChange,
  icon,
  title,
  detail,
}: {
  value: Visibility;
  checked: boolean;
  onChange: (value: Visibility) => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`ui-control flex cursor-pointer gap-3 rounded-xl border p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stone-900 ${
        checked ? "border-accent bg-accent/5" : "border-line bg-card hover:bg-stone-50"
      }`}
    >
      <input
        type="radio"
        name="visibility"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span aria-hidden="true" className={`mt-0.5 ${checked ? "text-accent" : "text-stone-600"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {checked ? (
            <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-white">Selected</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-stone-600">{detail}</span>
      </span>
    </label>
  );
}

/** Leave the social layer: deletes the social profile, its posts and relationships; the plan stays. */
export function DeleteSocialProfile() {
  const [open, setOpen] = useState(false);
  const [, action, pending] = useActionState(deleteSocialProfileAction, IDLE);
  return (
    <>
      <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
        Delete social profile
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete your social profile?"
        description="Your username, bio, posts, followers and following are deleted for good. Your planned sessions, routines and workouts are not touched."
        dismissible={!pending}
        initialFocus="[data-cancel]"
        className="max-w-md"
      >
        <form action={action} className="flex flex-wrap justify-end gap-2">
          <button type="button" data-cancel className={btnSecondary} disabled={pending} onClick={() => setOpen(false)}>
            Keep profile
          </button>
          <button type="submit" className={btnDanger} disabled={pending} aria-busy={pending}>
            {pending ? "Deleting…" : "Delete social profile"}
          </button>
        </form>
      </Modal>
    </>
  );
}
