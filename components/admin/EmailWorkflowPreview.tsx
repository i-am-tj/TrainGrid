import { btnSecondary } from "@/lib/ui";

export type EmailDeliveryPreviewState =
  "not_requested" | "preparing" | "accepted" | "failed";
const COPY = {
  not_requested: [
    "Not requested",
    "The invitation record exists. No email send has been requested.",
  ],
  preparing: [
    "Preparing email",
    "The message is being prepared. A second request stays disabled.",
  ],
  accepted: [
    "Request accepted",
    "The email provider accepted the request. This does not confirm delivery.",
  ],
  failed: [
    "Send failed",
    "The invitation still exists. An integrated service could retry sending or let you share the link.",
  ],
} as const;

/** Always labelled as a hypothetical preview, never a real invitation's delivery status. */
export function EmailWorkflowPreview({
  state,
}: {
  state: EmailDeliveryPreviewState;
}) {
  const [title, description] = COPY[state];
  return (
    <article className="rounded-lg border border-line bg-background p-4">
      <p className="text-[10px] uppercase tracking-widest text-stone-500">
        Design preview
      </p>
      <h4 className="mt-2 text-sm font-semibold">{title}</h4>
      <p className="mt-2 text-xs leading-6 text-stone-600">{description}</p>
      <button
        type="button"
        disabled
        aria-busy={state === "preparing" ? true : undefined}
        className={`${btnSecondary} mt-4 w-full text-xs disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {state === "failed"
          ? "Resend email"
          : state === "preparing"
            ? "Preparing…"
            : "Send invitation email"}
      </button>
    </article>
  );
}
