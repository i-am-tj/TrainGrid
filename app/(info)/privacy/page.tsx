import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/info/LegalPage";
import { canonicalUrl, contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · TrainGrid",
  description: "What TrainGrid stores, why, where it lives, and the choices you have.",
  alternates: canonicalUrl("/privacy") ? { canonical: canonicalUrl("/privacy")! } : undefined,
};

const UPDATED = "19 November 2026";

/**
 * The privacy notice. Written from what the code and database actually do;
 * keep it in step with any change to what is stored or who processes it.
 */
export default function PrivacyPage() {
  const email = contactEmail();
  const contact = email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <>the Feedback button in TrainGrid</>
  );

  return (
    <LegalPage
      eyebrow="Privacy"
      title="Your data, plainly"
      updated={UPDATED}
      intro={
        <p>
          TrainGrid is a small, invite-only training planner run by Tanuj Chakraborty. This notice
          explains what it keeps about you, why, and what you can do about it. It is written to be
          read, not skimmed past.
        </p>
      }
      summary={[
        "TrainGrid stores only what it needs to plan your training: your sign-in details and the sessions, routines and notes you create.",
        "Your plan is private to you. Nobody else can see it, including other members.",
        "There are no adverts, no analytics trackers and no selling of data. Ever.",
        "You can export everything as a file at any time, and ask for it all to be deleted.",
      ]}
      sections={[
        {
          id: "what-we-store",
          title: "What TrainGrid stores",
          body: (
            <>
              <p>
                <strong>Your account.</strong> When you sign in with Google or GitHub, TrainGrid
                receives your verified email address, your name and the address of your profile
                picture. There is no TrainGrid password.
              </p>
              <p>
                <strong>Your training.</strong> The sessions you plan (name, date, time, duration,
                notes and workout items) and the routines you create or copy.
              </p>
              <p>
                <strong>Feedback you send.</strong> Your message, its kind (idea, problem or praise)
                and the page you sent it from, linked to your account.
              </p>
              <p>
                <strong>Invitations.</strong> If you were invited, the email address the invitation
                was sent to, when it was accepted, and whether its invitation email was accepted by
                the email provider.
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies and your browser",
          body: (
            <>
              <p>TrainGrid uses a handful of strictly necessary cookies and nothing else:</p>
              <ul>
                <li>sign-in cookies, which keep you signed in;</li>
                <li>
                  <code>tg_tz</code>, your device’s time zone, so “today” means your today;
                </li>
                <li>
                  <code>tg_onboarding_hidden</code>, set only if you hide the getting-started card.
                </li>
              </ul>
              <p>
                Your light or dark mode choice is kept in your own browser’s storage and never sent
                to TrainGrid. There are no analytics, advertising or tracking cookies.
              </p>
            </>
          ),
        },
        {
          id: "invite-requests",
          title: "If you request an invite",
          body: (
            <>
              <p>
                Asking for an invitation from the sign-in page stores the email address you give, and
                the name and note if you add them, so the owner can review your request. A copy is
                emailed to the owner, and a reply comes from them personally. To limit abuse, the
                request also records a one-way, daily-changing code derived from your network address,
                never the address itself.
              </p>
              <p>
                Nothing is sent to you unless you are invited. Requests are deleted 180 days after
                they are made, or sooner if you ask.
              </p>
            </>
          ),
        },
        {
          id: "how-we-use-it",
          title: "How it is used",
          body: (
            <>
              <p>
                Only to run TrainGrid for you: to sign you in, show your plan, send your invitation
                email, and read the feedback you choose to send. Your data is never sold, never used
                for advertising, and never used to train AI models.
              </p>
            </>
          ),
        },
        {
          id: "where-it-lives",
          title: "Where it lives",
          body: (
            <>
              <p>TrainGrid relies on a few trusted services, each only for its part:</p>
              <ul>
                <li>
                  <strong>Supabase</strong> stores the database and handles sign-in, in Sydney,
                  Australia.
                </li>
                <li>
                  <strong>Vercel</strong> runs the app, in Sydney, and serves its pages through a
                  global network. Like any web host, it keeps short-lived request logs (such as IP
                  address and browser type) to operate and protect the service.
                </li>
                <li>
                  <strong>Resend</strong> delivers invitation emails and, if you send feedback or request
                  an invite, a copy of it to the owner.
                </li>
                <li>
                  <strong>Google</strong> or <strong>GitHub</strong>, whichever you choose, confirm who
                  you are when you sign in.
                </li>
              </ul>
              <p>
                Data travels encrypted (HTTPS) and is encrypted at rest by these providers. Inside the
                database, row-level security makes sure each member can only ever read their own plan.
              </p>
            </>
          ),
        },
        {
          id: "your-choices",
          title: "Your choices",
          body: (
            <>
              <ul>
                <li>
                  <strong>Take it with you:</strong> <em>Download my data</em> on your profile downloads your
                  routines and sessions as a file, whenever you like.
                </li>
                <li>
                  <strong>Delete it:</strong> ask through {contact} and your account and everything in
                  it will be deleted.
                </li>
                <li>
                  <strong>Ask about it:</strong> you can ask what TrainGrid holds about you, or for a
                  correction, the same way.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "how-long",
          title: "How long it is kept",
          body: (
            <p>
              For as long as you are a member. If your access is withdrawn, your plan is kept so it
              can be restored if you are invited again, until you ask for it to be deleted.
              Invitation emails that were never accepted can be withdrawn by the owner at any time.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes and contact",
          body: (
            <>
              <p>
                If this notice changes in a way that matters, the date above changes and{" "}
                <Link href="/whats-new">What’s new</Link> says so. TrainGrid is not intended for
                anyone under 16.
              </p>
              <p>Questions, or anything that doesn’t feel right? Get in touch through {contact}.</p>
            </>
          ),
        },
      ]}
    />
  );
}
