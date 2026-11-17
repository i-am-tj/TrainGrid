import type { ReactNode } from "react";
import type { InvitationStatus } from "@/lib/admin/invitation-model";
import { EmptyState } from "@/components/ui/Presentation";
export type InvitationListItem = {
  id: string;
  email: string;
  createdLabel: string;
  status: InvitationStatus;
  isAdmin: boolean;
  revokedAccess: boolean;
  action: ReactNode;
};
const STATUS_STYLE: Record<InvitationStatus, string> = {
  Pending: "bg-amber-50 text-amber-900",
  Accepted: "bg-emerald-50 text-emerald-900",
  Revoked: "bg-stone-100 text-stone-600",
};
export function InvitationListView({
  invitations,
}: {
  invitations: InvitationListItem[];
}) {
  if (!invitations.length)
    return (
      <div className="mt-4">
        <EmptyState title="No invitations yet.">
          Invite someone using their verified Google or GitHub email address.
          You can share the sign-in link once access is created.
        </EmptyState>
      </div>
    );
  return (
    <div className="mt-4">
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem] gap-4 px-5 pb-3 text-xs font-medium text-stone-500 md:grid"
      >
        <span>Recipient</span>
        <span>Membership</span>
        <span>Access controls</span>
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="grid min-w-0 gap-4 p-5 md:grid-cols-[minmax(0,1fr)_7rem_9rem] md:items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium [overflow-wrap:anywhere]">
                {invitation.email}
              </p>
              <p className="mt-1 text-xs leading-6 text-stone-500">
                Invited {invitation.createdLabel}
                {invitation.revokedAccess ? " · Access revoked, data kept" : ""}
              </p>
              {invitation.isAdmin && (
                <p className="mt-1 text-xs text-accent">Admin · Protected</p>
              )}
            </div>
            <div>
              <span
                className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[invitation.status]}`}
              >
                {invitation.status}
              </span>
            </div>
            <div className="min-w-0">{invitation.action}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
