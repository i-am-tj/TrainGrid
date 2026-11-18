import { describe, expect, it } from "vitest";
import { renderInvitationEmail } from "./invitation";

describe("invitation email presentation", () => {
  it("provides matching subject, preheader, branded HTML and a usable text alternative", () => {
    const email = renderInvitationEmail({
      recipientEmail: "member@example.test",
      loginUrl: "https://traingrid.example.test/login",
    });
    expect(email.subject).toBe("You’re invited to TrainGrid");
    expect(email.html).toContain(email.preheader);
    for (const body of [email.html, email.text]) {
      expect(body).toContain("member@example.test");
      expect(body).toContain("Google or GitHub");
      expect(body).toContain("verified email");
      expect(body).toContain("invite-only early access");
      expect(body).toContain("https://traingrid.example.test/login");
    }
    expect(email.html).toContain(
      'src="https://traingrid.example.test/brand/traingrid-logo-google-120.png"',
    );
    expect(email.html).toContain('role="presentation"');
    expect(email.html).not.toMatch(/<script|<form|<svg|javascript:/i);
    expect(email.text).not.toMatch(/<table|<a /i);
  });
  it("escapes dynamic links for HTML while retaining a plain-text URL", () => {
    const loginUrl = "https://example.test/login?next=%2Flibrary&source=admin";
    const email = renderInvitationEmail({
      recipientEmail: "alex+training@example.test",
      loginUrl,
    });
    expect(email.html).toContain("next=%2Flibrary&amp;source=admin");
    expect(email.html).not.toContain('href="' + loginUrl + '"');
    expect(email.text).toContain(loginUrl);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///login",
    "/login",
    "https://user:password@example.test/login",
  ])("refuses unsafe or non-absolute URL %s", (loginUrl) => {
    expect(() =>
      renderInvitationEmail({ recipientEmail: "alex@example.test", loginUrl }),
    ).toThrow();
  });
  it.each([
    "not-an-email",
    "<script>@example.test",
    "alex@example.test\r\nBcc: other@example.test",
  ])("refuses an invalid recipient", (recipientEmail) => {
    expect(() =>
      renderInvitationEmail({
        recipientEmail,
        loginUrl: "https://example.test/login",
      }),
    ).toThrow();
  });
});
