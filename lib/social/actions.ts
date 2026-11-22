"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DataError } from "@/lib/data/model";
import { memberData } from "@/lib/data/server";
import {
  acceptFollowRequest,
  createPost,
  deletePost,
  deleteSocialProfile,
  followMember,
  rejectFollowRequest,
  removeFollower,
  saveSocialProfile,
  unfollowMember,
  updatePostCaption,
} from "@/lib/data/social";
import { safeReturnPath } from "./model";
import type { FormState } from "./form-state";

/**
 * Every social mutation. Each starts from memberData(): the verified member's
 * own client and user id, so nothing here reads an owner or user id from the
 * form. The data layer validates every value and narrows every write to the
 * member, and Row Level Security enforces the same again.
 *
 * Expected problems (a taken username, a rate limit) come back as form state
 * for the page to show; anything else is a real error.
 */

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function checked(form: FormData, name: string): boolean {
  const value = text(form, name);
  return value === "on" || value === "true";
}

function revalidateSocial() {
  revalidatePath("/", "layout");
}

async function run(work: () => Promise<void>): Promise<FormState> {
  try {
    await work();
    return { status: "done", message: null };
  } catch (error) {
    if (error instanceof DataError) return { status: "error", message: error.message };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function saveSocialProfileAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  let username: string;
  try {
    const saved = await saveSocialProfile(db, userId, {
      username: text(form, "username"),
      displayName: text(form, "displayName"),
      bio: text(form, "bio"),
      visibility: text(form, "visibility") as "public" | "private",
      useIdentityAvatar: checked(form, "useIdentityAvatar"),
    });
    username = saved.username;
  } catch (error) {
    if (error instanceof DataError) return { status: "error", message: error.message };
    throw error;
  }
  revalidateSocial();
  const next = safeReturnPath(text(form, "next"), "");
  redirect(next || `/people/${username}?saved=1`);
}

export async function deleteSocialProfileAction(): Promise<FormState> {
  const { db, userId } = await memberData();
  await deleteSocialProfile(db, userId);
  revalidateSocial();
  redirect("/profile/social?deleted=1");
}

// ---------------------------------------------------------------------------
// Following
// ---------------------------------------------------------------------------

export async function followAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  const state = await run(async () => {
    await followMember(db, userId, text(form, "userId"));
  });
  revalidateSocial();
  return state;
}

/** Unfollow, or cancel a pending request: either way the member's own row goes. */
export async function unfollowAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  const state = await run(() => unfollowMember(db, userId, text(form, "userId")));
  revalidateSocial();
  return state;
}

export async function acceptRequestAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  const state = await run(() => acceptFollowRequest(db, userId, text(form, "userId")));
  revalidateSocial();
  return state;
}

export async function rejectRequestAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  const state = await run(() => rejectFollowRequest(db, userId, text(form, "userId")));
  revalidateSocial();
  return state;
}

export async function removeFollowerAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  const state = await run(() => removeFollower(db, userId, text(form, "userId")));
  revalidateSocial();
  return state;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function createPostAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  let postId: string;
  try {
    postId = await createPost(db, userId, {
      sessionId: text(form, "sessionId"),
      caption: text(form, "caption"),
      showsDuration: checked(form, "showsDuration"),
    });
  } catch (error) {
    if (error instanceof DataError) return { status: "error", message: error.message };
    throw error;
  }
  revalidateSocial();
  redirect(`/feed?posted=${postId}`);
}

export async function updatePostAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  const id = text(form, "id");
  const state = await run(() => updatePostCaption(db, userId, id, text(form, "caption")));
  if (state.status === "error") return state;
  revalidateSocial();
  redirect(`/posts/${id}?saved=1`);
}

export async function deletePostAction(_previous: FormState, form: FormData): Promise<FormState> {
  const { db, userId } = await memberData();
  const state = await run(() => deletePost(db, userId, text(form, "id")));
  if (state.status === "error") return state;
  revalidateSocial();
  redirect(safeReturnPath(text(form, "returnTo"), "/feed"));
}
