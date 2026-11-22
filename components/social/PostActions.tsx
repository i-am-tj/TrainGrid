"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { deletePostAction } from "@/lib/social/actions";
import { IDLE } from "@/lib/social/form-state";
import { btnDanger, btnSecondary, btnSecondaryCompact } from "@/lib/ui";

/** The author's Edit and Delete for one post; Delete asks first, in TrainGrid's own dialog. */
export function PostActions({ postId, returnTo }: { postId: string; returnTo: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deletePostAction, IDLE);

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Link href={`/posts/${postId}/edit`} className={btnSecondaryCompact} aria-label="Edit post">
        Edit
      </Link>
      <button type="button" className={btnSecondaryCompact} onClick={() => setOpen(true)} aria-label="Delete post">
        Delete
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this post?"
        description="It disappears from your profile and your followers’ feeds. Your planned session is not affected."
        dismissible={!pending}
        initialFocus="[data-cancel]"
        className="max-w-md"
      >
        <form action={action} className="flex flex-wrap justify-end gap-2">
          <input type="hidden" name="id" value={postId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {state.status === "error" ? (
            <p role="alert" className="w-full text-sm text-red-800">
              {state.message}
            </p>
          ) : null}
          <button type="button" data-cancel className={btnSecondary} disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="submit" className={btnDanger} disabled={pending} aria-busy={pending}>
            {pending ? "Deleting…" : "Delete post"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
