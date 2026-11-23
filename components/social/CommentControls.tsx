"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { addCommentAction, deleteCommentAction } from "@/lib/social/actions";
import { IDLE } from "@/lib/social/form-state";
import { COMMENT_MAX } from "@/lib/social/model";
import { btnDanger, btnPrimary, btnSecondary, fieldClass } from "@/lib/ui";

/** The interactive parts of the comments: the add box and the delete dialog. */

export function CommentForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(addCommentAction, IDLE);
  const [body, setBody] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const fieldId = useId();
  const counterId = useId();
  const over = body.length > COMMENT_MAX;

  // A posted comment clears the box.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.status === "done") setBody("");
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor={fieldId} className="text-sm font-medium">
        Add a comment
      </label>
      <textarea
        id={fieldId}
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/⌘ + Enter posts, as in most comment boxes.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && body.trim() && !over) form.current?.requestSubmit();
        }}
        rows={2}
        aria-describedby={counterId}
        aria-invalid={over || undefined}
        placeholder="Nice work!"
        className={`${fieldClass} resize-y leading-6`}
      />
      <div className="flex items-center justify-between gap-3">
        <span id={counterId} className={`text-xs tabular-nums ${over ? "text-red-800" : "text-stone-600"}`}>
          {body.length}/{COMMENT_MAX}
        </span>
        <button type="submit" className={btnPrimary} disabled={pending || !body.trim() || over} aria-busy={pending}>
          {pending ? "Posting…" : "Post comment"}
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function DeleteComment({ id, own }: { id: string; own: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: typeof IDLE, form: FormData) => {
    const next = await deleteCommentAction(previous, form);
    if (next.status !== "error") setOpen(false);
    return next;
  }, IDLE);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={own ? "Delete your comment" : "Delete this comment"}
        className="ui-control grid size-8 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-red-800"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
        </svg>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this comment?"
        description={own ? "It’s removed for everyone." : "It’s on your post, so you can remove it. It’s removed for everyone."}
        dismissible={!pending}
        initialFocus="[data-cancel]"
        className="max-w-md"
      >
        <form action={action} className="flex flex-wrap justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          {state.status === "error" ? (
            <p role="alert" className="w-full text-sm text-red-800">
              {state.message}
            </p>
          ) : null}
          <button type="button" data-cancel className={btnSecondary} disabled={pending} onClick={() => setOpen(false)}>
            Keep
          </button>
          <button type="submit" className={btnDanger} disabled={pending} aria-busy={pending}>
            {pending ? "Deleting…" : "Delete comment"}
          </button>
        </form>
      </Modal>
    </>
  );
}
