import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/info/LegalPage";
import { canonicalUrl, contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms · TrainGrid",
  description: "The terms for using TrainGrid during early access.",
  alternates: canonicalUrl("/terms") ? { canonical: canonicalUrl("/terms")! } : undefined,
};

const UPDATED = "18 November 2026";

export default function TermsPage() {
  const email = contactEmail();
  const contact = email ? <a href={`mailto:${email}`}>{email}</a> : <>the Feedback button in TrainGrid</>;

  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of use"
      updated={UPDATED}
      intro={
        <p>
          These terms cover your use of TrainGrid during early access. They are short on purpose. By
          signing in, you agree to them; if you don’t, please don’t use TrainGrid.
        </p>
      }
      summary={[
        "TrainGrid is in invite-only early access: free to use, improving often, and offered as it is.",
        "What you plan is yours. TrainGrid only stores it so it can show it back to you.",
        "TrainGrid is a planner, not a coach or a doctor. Train within your limits.",
        "Either side can end your access at any time; you can always export your plan first.",
      ]}
      sections={[
        {
          id: "early-access",
          title: "Early access",
          body: (
            <>
              <p>
                TrainGrid is offered by invitation, free of charge, while it is shaped with its first
                members. Features may change, improve or occasionally be removed, and the service may
                sometimes be unavailable. Every effort goes into keeping your plan safe, but TrainGrid
                is provided “as is”, without guarantees of availability or fitness for a particular
                purpose.
              </p>
              <p>
                If TrainGrid ever moves to a paid plan, you will be told well in advance, and nothing
                will be charged without your clear agreement.
              </p>
            </>
          ),
        },
        {
          id: "your-account",
          title: "Your account",
          body: (
            <ul>
              <li>
                Sign in with the Google or GitHub account whose verified email matches your invitation.
              </li>
              <li>
                Your account is for you alone. Keep that Google or GitHub account secure, as it is your
                key to TrainGrid.
              </li>
              <li>Let the owner know straight away if you think someone else has used your account.</li>
            </ul>
          ),
        },
        {
          id: "your-content",
          title: "Your content",
          body: (
            <>
              <p>
                The sessions, routines and notes you create are yours. You allow TrainGrid to store and
                display them to you, which is all it does with them. The shared TrainGrid routines in
                the library are provided for your personal training; copies you make are yours to adapt.
              </p>
              <p>
                How your data is handled is described in the <Link href="/privacy">privacy notice</Link>.
              </p>
            </>
          ),
        },
        {
          id: "train-sensibly",
          title: "Train sensibly",
          body: (
            <>
              <p>
                TrainGrid helps you organise training; it does not give medical, health or coaching
                advice, and the shared routines are general examples, not a programme designed for you.
                Check with a qualified professional before starting or changing an exercise programme,
                especially if you have an injury or a health condition, and stop if anything hurts.
              </p>
              <p>You train at your own risk, and you are responsible for choosing what is safe for you.</p>
            </>
          ),
        },
        {
          id: "fair-use",
          title: "Fair use",
          body: (
            <ul>
              <li>Don’t try to access another member’s data or any part of TrainGrid you weren’t given.</li>
              <li>Don’t disrupt the service, probe it for weaknesses, or overload it with automated requests.</li>
              <li>
                Found a security problem? Thank you. Please report it privately through {contact} rather
                than testing it further.
              </li>
            </ul>
          ),
        },
        {
          id: "ending",
          title: "Ending your access",
          body: (
            <p>
              You can stop using TrainGrid at any time and ask for your data to be deleted. Access may be
              withdrawn if these terms are broken or when early access changes; when that happens, your
              plan is kept until you ask for it to be deleted, and you can export it first.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Responsibility",
          body: (
            <p>
              To the extent the law allows, TrainGrid and its owner are not liable for indirect or
              consequential loss, or for loss of data, arising from your use of the service. Nothing in
              these terms limits anything that cannot be limited by law, including your rights as a
              consumer.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes and contact",
          body: (
            <p>
              If these terms change in a way that matters, the date above changes and{" "}
              <Link href="/whats-new">What’s new</Link> says so. Questions? Get in touch through {contact}.
            </p>
          ),
        },
      ]}
    />
  );
}
