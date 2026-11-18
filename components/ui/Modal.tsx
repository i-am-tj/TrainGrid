"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * TrainGrid's modal dialog, on the native <dialog> element: the browser
 * provides the focus trap, Escape to close, and returns focus to whatever
 * opened it. It fades and rises in over a soft, blurred backdrop
 * (globals.css, .ui-modal; still for reduced motion), and closes on a click
 * outside the panel unless `dismissible` is false (e.g. while saving).
 *
 * Controlled: `open` shows or closes it; `onClose` runs whenever the dialog
 * closes for any reason (Escape, the close button, a click outside).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
  initialFocus,
  className = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  dismissible?: boolean;
  /** CSS selector inside the dialog to focus on open; else the first focusable element. */
  initialFocus?: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      const target = initialFocus ? element.querySelector<HTMLElement>(initialFocus) : null;
      target?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, initialFocus]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself, outside its panel.
        if (dismissible && event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={`ui-modal ui-panel m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto p-0 text-foreground shadow-2xl ${className}`}
    >
      <div className="relative p-5 sm:p-7">
        <button
          type="button"
          aria-label="Close"
          disabled={!dismissible}
          onClick={() => dialog.current?.close()}
          className="ui-control absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-40 sm:right-4 sm:top-4"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
        <h2 id={titleId} className="pr-10 text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-2 pr-6 text-sm leading-6 text-stone-600">
            {description}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
