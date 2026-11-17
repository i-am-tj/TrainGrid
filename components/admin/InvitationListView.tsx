import type { ReactNode } from "react";
import type { InvitationStatus } from "@/lib/admin/invitation-model";
import { EmptyState } from "@/components/ui/Presentation";
import { RowFeedbackOutlet, RowFeedbackProvider } from "@/components/admin/RowFeedback";
export type InvitationListItem = {
  id: string;
  email: string;
  createdLabel: string;
  status: InvitationStatus;
  isAdmin: boolean;
  revokedAccess: boolean;
  action: ReactNode;
  /** Live email status text, prepared by the server from the delivery log. */
  emailStatus?: { label: string; tone: "neutral" | "success" | "warning" } | null;
  /** The send/resend form, when the server allows sending for this row. */
  emailAction?: ReactNode;
};
const EMAIL_STYLE = {
  neutral: "text-stone-600",
  success: "text-emerald-800",
  warning: "text-amber-900",
} as const;
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
        className="hidden grid-cols-[minmax(0,1fr)_7rem_13rem] gap-4 px-5 pb-3 text-xs font-medium text-stone-600 md:grid"
      >
        <span>Recipient</span>
        <span>Membership</span>
        <span className="text-right">Access controls</span>
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="min-w-0 p-5">
            <RowFeedbackProvider>
              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_7rem_13rem] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">
                    {invitation.email}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-stone-600">
                    Invited {invitation.createdLabel}
                    {invitation.revokedAccess ? " · Access revoked, data kept" : ""}
                  </p>
                  {invitation.isAdmin && (
                    <p className="mt-1 text-xs text-accent">Admin · Protected</p>
                  )}
                  {invitation.emailStatus && (
                    <p
                      className={`text-xs leading-6 ${EMAIL_STYLE[invitation.emailStatus.tone]}`}
                    >
                      {invitation.emailStatus.label}
                    </p>
                  )}
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[invitation.status]}`}
                  >
                    {invitation.status}
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">
                  {invitation.emailAction}
                  {invitation.action}
                </div>
              </div>
              <RowFeedbackOutlet className="[&:not(:empty)]:mt-3" />
            </RowFeedbackProvider>
          </li>
        ))}
      </ul>
    </div>
  );
}
