import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { InviteForm, RevokeForm } from "@/components/admin/InvitationForms";
import { getAdminViewer } from "@/lib/admin/guard";
import { invitationStatus, type InvitationStatus } from "@/lib/admin/invitation-model";
import { listInvitations } from "@/lib/admin/invitations";
import { originFromHeaders } from "@/lib/auth/redirect";
import { isSecretKeyConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitations · TrainGrid",
  robots: { index: false, follow: false },
};

const STATUS_STYLE: Record<InvitationStatus, string> = {
  Pending: "bg-amber-50 text-amber-900",
  Accepted: "bg-emerald-50 text-emerald-900",
  Revoked: "bg-stone-100 text-stone-600",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

export default async function InvitationsPage() {
  // Anyone who is not an admin gets the same 404 as a page that does not exist.
  if (!(await getAdminViewer())) notFound();

  if (!isSecretKeyConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4">
        <h1 className="text-xl font-semibold tracking-tight">Invitations</h1>
        <p className="mt-3 text-sm text-stone-700">
          Invitation management is not configured on this deployment.
        </p>
      </div>
    );
  }

  const invitations = await listInvitations();
  const signInUrl = `${originFromHeaders(await headers())}/login`;

  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-4">
      <h1 className="text-xl font-semibold tracking-tight">Invitations</h1>
      <p className="mt-1.5 text-sm text-stone-600">
        Only invited email addresses can use TrainGrid. An invitation is matched against the
        verified email of the Google or GitHub account the person signs in with.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-card px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold">Invite someone</h2>
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

      <section className="mt-6">
        <h2 className="text-sm font-semibold">All invitations</h2>
        {invitations.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">No invitations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
            {invitations.map((invitation) => {
              const status = invitationStatus(invitation);
              return (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-all">{invitation.email}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Invited {formatDate(invitation.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}
                    >
                      {status}
                    </span>
                    {status === "Pending" ? (
                      <RevokeForm id={invitation.id} email={invitation.email} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
