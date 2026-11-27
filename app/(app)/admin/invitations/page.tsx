import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionLoader } from "@/components/LogoLoader";
import { PageHeading } from "@/components/ui/Presentation";
import { InvitationEmailPreview } from "@/components/admin/InvitationEmailPreview";
import { InvitationListView } from "@/components/admin/InvitationListView";
import { InviteForm, RevokeForm, SendEmailForm } from "@/components/admin/InvitationForms";
import { InviteRequestList } from "@/components/admin/InviteRequests";
import { RequestsUnavailable } from "@/components/admin/RequestsUnavailable";
import { listPendingInviteRequests } from "@/lib/admin/invite-requests";
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
import { contactEmail, trustedLoginUrl } from "@/lib/site";
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

      {contactEmail() ? null : (
        <p
          role="status"
          data-testid="contact-email-missing"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          <span className="font-semibold">No public contact address.</span> Set <code className="break-all">TRAINGRID_CONTACT_EMAIL</code> so
          the privacy notice can offer it. Without it, someone whose access you revoke has no way to ask TrainGrid to
          delete their data.
        </p>
      )}

      <section className="mt-7" aria-labelledby="requests-title">
        <h2 id="requests-title" className="text-lg font-semibold tracking-tight">
          Requests
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          People who asked for an invitation from the sign-in page, oldest first.
        </p>
        <Suspense fallback={<SectionLoader label="Loading requests…" minHeight="min-h-24" />}>
          <RequestList emailReady={emailReady} timeZone={timeZone} />
        </Suspense>
      </section>

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

/** Pending invite requests, streamed behind their own loader. */
async function RequestList({ emailReady, timeZone }: { emailReady: boolean; timeZone: string }) {
  const pending = await listPendingInviteRequests();
  if (pending.status === "unavailable") return <RequestsUnavailable />;
  const formatTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone });
  return (
    <InviteRequestList
      emailReady={emailReady}
      requests={pending.requests.map((request) => ({
        id: request.id,
        email: request.email,
        name: request.name,
        note: request.note,
        requestedLabel: formatTime.format(new Date(request.created_at)),
        history: request.history,
      }))}
    />
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
