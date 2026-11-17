import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SectionLoader } from "@/components/LogoLoader";
import { PageHeading } from "@/components/ui/Presentation";
import { InvitationEmailPreview } from "@/components/admin/InvitationEmailPreview";
import { InvitationListView } from "@/components/admin/InvitationListView";
import { InviteForm, RevokeForm } from "@/components/admin/InvitationForms";
import { getAdminViewer } from "@/lib/admin/guard";
import { invitationStatus, revokeKind } from "@/lib/admin/invitation-model";
import { listInvitations, protectedUserIds } from "@/lib/admin/invitations";
import { originFromHeaders } from "@/lib/auth/redirect";
import { isSecretKeyConfigured } from "@/lib/supabase/admin";

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
  const signInUrl = `${originFromHeaders(await headers())}/login`;

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
          <InviteForm />
        </div>
        <p className="mt-4 text-sm text-stone-600">
          No email is sent. After inviting, send them this link yourself:
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
          <InvitationList protectedIds={protectedIds} />
        </Suspense>
      </section>
    </div>
  );
}

/** The invitation list, streamed behind a section loader; the invite form above is ready at once. */
async function InvitationList({ protectedIds }: { protectedIds: Set<string> }) {
  const invitations = await listInvitations();
  return (
    <InvitationListView
      invitations={invitations.map((invitation) => {
        const kind = revokeKind(invitation, protectedIds);
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
