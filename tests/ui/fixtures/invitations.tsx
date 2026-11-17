/** UI examples only: never imported into app routes or mutation code. */
import {
  InvitationListView,
  type InvitationListItem,
} from "../../../components/admin/InvitationListView";
import {
  EmailWorkflowPreview,
  type EmailDeliveryPreviewState,
} from "../../../components/admin/EmailWorkflowPreview";
import { PageHeading } from "../../../components/ui/Presentation";
import { btnDanger } from "../../../lib/ui";
const examples: InvitationListItem[] = [
  {
    id: "example-pending",
    email: "training.partner@example.test",
    createdLabel: "17 Nov 2026",
    status: "Pending",
    isAdmin: false,
    revokedAccess: false,
    action: (
      <button disabled className={btnDanger}>
        Revoke
      </button>
    ),
  },
  {
    id: "example-accepted",
    email: "member@example.test",
    createdLabel: "15 Nov 2026",
    status: "Accepted",
    isAdmin: false,
    revokedAccess: false,
    action: (
      <button disabled className={btnDanger}>
        Revoke access
      </button>
    ),
  },
  {
    id: "example-revoked",
    email: "former.member@example.test",
    createdLabel: "12 Nov 2026",
    status: "Revoked",
    isAdmin: false,
    revokedAccess: true,
    action: null,
  },
  {
    id: "example-admin",
    email: "admin@example.test",
    createdLabel: "10 Nov 2026",
    status: "Accepted",
    isAdmin: true,
    revokedAccess: false,
    action: null,
  },
];
export function InvitationFixture({ empty = false }: { empty?: boolean }) {
  return (
    <div className="mx-auto max-w-4xl px-3 py-8">
      <PageHeading eyebrow="Member access · example" title="Invitations" />
      <p className="mt-4 text-sm leading-7 text-stone-600">
        Membership status is independent from email delivery. These are example
        records; no email is sent.
      </p>
      <h2 className="mt-6 text-lg font-semibold">All invitations</h2>
      <InvitationListView invitations={empty ? [] : examples} />
      <h2 className="mt-8 text-lg font-semibold">
        Future email workflow · design preview
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            "not_requested",
            "preparing",
            "accepted",
            "failed",
          ] as EmailDeliveryPreviewState[]
        ).map((state) => (
          <EmailWorkflowPreview key={state} state={state} />
        ))}
      </div>
    </div>
  );
}
