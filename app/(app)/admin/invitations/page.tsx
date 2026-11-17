import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionLoader } from "@/components/LogoLoader";
import { PageHeading } from "@/components/ui/Presentation";
import { InvitationEmailPreview } from "@/components/admin/InvitationEmailPreview";
import { InvitationListView } from "@/components/admin/InvitationListView";
import { InviteForm, RevokeForm, SendEmailForm } from "@/components/admin/InvitationForms";
import { getAdminViewer } from "@/lib/admin/guard";
import {
  canEmailInvitation,
  emailStatusLabel,
  invitationStatus,
  latestEmailDelivery,
  revokeKind,
} from "@/lib/admin/invitation-model";
import {
  invitationEmailReady,
  listInvitations,
  protectedUserIds,
} from "@/lib/admin/invitations";
import { originFromHeaders } from "@/lib/auth/redirect";
import { trustedLoginUrl } from "@/lib/site";
import { isSecretKeyConfigured } from "@/lib/supabase/admin";
import { getRequestTimeZone } from "@/lib/today";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitations · TrainGrid",
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default async function InvitationsPage() {
  // Anyone who is not an admin gets the same 404 as a page that does not exist.
  const admin = await getAdminViewer();
  if (!admin) notFound();

  if (!isSecretKeyConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-3 py-8 sm:px-4 sm:py-10">
        <PageHeading eyebrow="Member access" title="Invitations" />
        <p className="mt-3 text-sm text-stone-700">
          Invitation management is not configured on this deployment.
        </p>
      </div>
    );
  }

  const protectedIds = protectedUserIds(admin.userId);
  // The configured origin when known (it is what emails use), else this request's.
  const signInUrl = trustedLoginUrl() ?? `${originFromHeaders(await headers())}/login`;
  const emailReady = invitationEmailReady();
  const timeZone = await getRequestTimeZone();

  return (
    <div className="mx-auto max-w-4xl px-3 py-8 sm:px-4 sm:py-10">
      <PageHeading eyebrow="Member access" title="Invitations" />
      <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600">
        Only invited email addresses can use TrainGrid. An invitation is matched
        against the verified email of the Google or GitHub account the person
        signs in with. Revoking an accepted member removes their access but
        keeps their data; inviting the same email again restores it. Admins
        cannot be revoked.
      </p>

      <section className="ui-panel mt-7 px-5 py-6 sm:p-7">
        <h2 className="text-lg font-semibold tracking-tight">Invite someone</h2>
        <div className="mt-3">
          <InviteForm emailReady={emailReady} />
        </div>
        <p className="mt-4 text-sm text-stone-600">
          {emailReady
            ? "TrainGrid emails this sign-in link when the box is ticked. You can also share it yourself:"
            : "No email is sent. After inviting, send them this link yourself:"}
        </p>
        <p className="mt-1.5 rounded-md border border-line bg-white px-3 py-2 font-mono text-sm break-all select-all">
          {signInUrl}
        </p>
      </section>

      <InvitationEmailPreview loginUrl={signInUrl} />

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          All invitations
        </h2>
        <Suspense
          fallback={
            <SectionLoader label="Loading invitations…" minHeight="min-h-32" />
          }
        >
          <InvitationList
            protectedIds={protectedIds}
            emailReady={emailReady}
            timeZone={timeZone}
          />
        </Suspense>
      </section>
    </div>
  );
}

/** The invitation list, streamed behind a section loader; the invite form above is ready at once. */
async function InvitationList({
  protectedIds,
  emailReady,
  timeZone,
}: {
  protectedIds: Set<string>;
  emailReady: boolean;
  timeZone: string;
}) {
  const invitations = await listInvitations();
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(iso));
  return (
    <InvitationListView
      invitations={invitations.map((invitation) => {
        const kind = revokeKind(invitation, protectedIds);
        const delivery = latestEmailDelivery(invitation.deliveries);
        const pending = invitationStatus(invitation) === "Pending";
        return {
          id: invitation.id,
          email: invitation.email,
          createdLabel: formatDate(invitation.created_at),
          status: invitationStatus(invitation),
          isAdmin: Boolean(
            invitation.accepted_by &&
            protectedIds.has(invitation.accepted_by.toLowerCase()),
          ),
          revokedAccess: Boolean(
            invitation.accepted_at && invitation.revoked_at,
          ),
          // Shown while emailing is possible, or once there is history to report.
          emailStatus:
            (emailReady && pending) || delivery.state !== "not_requested"
              ? emailStatusLabel(delivery, formatTime)
              : null,
          emailAction:
            emailReady && canEmailInvitation(invitation, delivery) ? (
              <SendEmailForm
                id={invitation.id}
                email={invitation.email}
                resend={delivery.state !== "not_requested"}
              />
            ) : null,
          action: kind ? (
            <RevokeForm
              id={invitation.id}
              email={invitation.email}
              kind={kind}
            />
          ) : null,
        };
      })}
    />
  );
}
