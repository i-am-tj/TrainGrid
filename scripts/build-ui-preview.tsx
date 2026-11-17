/** Static component QA harness. No Next route, auth bypass, database access or deployment. */
import { SkipLink } from "../components/ui/SkipLink";
import { InvitationFixture } from "../tests/ui/fixtures/invitations";
import { renderInvitationEmail } from "../lib/email/invitation";
import type { ReactNode } from "react";
import { MemberDashboard } from "../components/dashboard/MemberDashboard";
import { dashboardFixtures } from "../tests/ui/fixtures/dashboard";
import { LoginFixtureView, loginFixtures } from "../tests/ui/fixtures/login";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../components/marketing/LandingPage";
import { PublicHeader } from "../components/marketing/PublicHeader";
import { SiteFooter } from "../components/footer/SiteFooter";

async function main() {
  const directory = path.resolve(".next/ui-preview");
  await mkdir(directory, { recursive: true });
  const css = await postcss([tailwind()]).process(
    await readFile("app/globals.css", "utf8"),
    { from: path.resolve("app/globals.css") },
  );
  await writeFile(path.join(directory, "styles.css"), css.css);
  const markup = renderToStaticMarkup(
    <>
      <SkipLink />
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <LandingPage />
      </main>
      <SiteFooter />
    </>,
  );
  await writeFile(
    path.join(directory, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TrainGrid — component preview</title><link rel="stylesheet" href="/styles.css"></head><body>${markup}</body></html>`,
  );
  const writeFixture = async (name: string, content: ReactNode) => {
    const fixtureMarkup = renderToStaticMarkup(
      <>
        <SkipLink />
        <PublicHeader />
        <main id="main-content" tabIndex={-1}>
          <p className="border-b border-line px-4 py-2 text-center text-xs text-stone-600">
            Component preview · example content, not a live member account
          </p>
          {content}
        </main>
        <SiteFooter />
      </>,
    );
    await writeFile(
      path.join(directory, `${name}.html`),
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TrainGrid — ${name} preview</title><link rel="stylesheet" href="/styles.css"></head><body>${fixtureMarkup}</body></html>`,
    );
  };
  for (const [name, state] of Object.entries(dashboardFixtures))
    await writeFixture(`dashboard-${name}`, <MemberDashboard state={state} />);
  await writeFixture("invitations-ready", <InvitationFixture />);
  await writeFixture("invitations-empty", <InvitationFixture empty />);
  await writeFile(
    path.join(directory, "invitation-email.html"),
    renderInvitationEmail({
      recipientEmail: "example.member@example.test",
      loginUrl: "http://ui-preview.test/login",
    }).html,
  );
  for (const name of loginFixtures)
    await writeFixture(`login-${name}`, <LoginFixtureView name={name} />);
  console.log(
    "Static UI preview prepared in .next/ui-preview (not an application route).",
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
