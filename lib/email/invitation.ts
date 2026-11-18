/** Pure email presentation. No provider, network, authorization or persistence dependency. */
import { z } from "zod";

export type InvitationEmailInput = { recipientEmail: string; loginUrl: string };
export type InvitationEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};
const emailSchema = z.email().max(320);
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function renderInvitationEmail({
  recipientEmail,
  loginUrl,
}: InvitationEmailInput): InvitationEmail {
  const email = emailSchema.parse(recipientEmail.trim());
  const url = new URL(loginUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new TypeError("A trusted absolute HTTP(S) login URL is required.");
  const href = escapeHtml(url.href);
  const subject = "You’re invited to TrainGrid";
  const preheader =
    "Your training week, thoughtfully together. Join invite-only early access.";
  const text = `${subject}\n\nPlan the week. Own the work.\n\nTrainGrid brings your weekly training planner, shared workout library and personal routines together.\n\nYou’re invited using: ${email}\n\nOpen TrainGrid: ${url.href}\n\nSign in with the Google or GitHub account whose verified email matches ${email}. There’s no separate TrainGrid password.\n\nTrainGrid is in invite-only early access. If you weren’t expecting this invitation, you can ignore it.\n\nTrainGrid · A clear plan. Space to train.`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:600px){.email-pad{padding:28px 20px!important}.email-heading{font-size:30px!important}}</style></head>
<body style="margin:0;padding:0;background:#f4f1ea;color:#1c1917;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fffcf7;border:1px solid #e7e0d4;border-radius:16px">
<tr><td class="email-pad" style="padding:40px 40px 24px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td><img src="${escapeHtml(url.origin)}/brand/traingrid-logo-google-120.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:7px"></td><td style="padding-left:10px;font-size:19px;font-weight:bold">TrainGrid</td><td style="padding-left:12px;font-size:11px;color:#57534e">INVITE-ONLY EARLY ACCESS</td></tr></table></td></tr>
<tr><td class="email-pad" style="padding:16px 40px 40px">
<p style="margin:0 0 16px;color:#9a4e24;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">A clear plan. Space to train.</p>
<h1 class="email-heading" style="margin:0 0 20px;font-size:36px;line-height:1.15;letter-spacing:-1px">You’re invited to TrainGrid.</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:26px">Plan the week. Own the work.</p>
<p style="margin:0 0 24px;font-size:14px;line-height:24px;color:#57534e">Your weekly training planner, shared workout library and personal routines, thoughtfully together.</p>
<p style="margin:0 0 24px;padding:16px;border:1px solid #e7e0d4;border-radius:8px;font-size:14px;line-height:24px;word-break:break-all">Invited email<br><strong>${escapeHtml(email)}</strong></p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#1c1917" style="border-radius:8px;mso-padding-alt:14px 24px"><a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 24px;border:1px solid #1c1917;border-radius:8px;color:#fffcf7;font-size:14px;font-weight:bold;text-decoration:none">Open TrainGrid &#8599;</a></td></tr></table>
<p style="margin:24px 0 0;font-size:14px;line-height:24px;color:#57534e">Sign in with the Google or GitHub account whose verified email matches <strong style="word-break:break-all">${escapeHtml(email)}</strong>. There’s no separate TrainGrid password.</p>
<p style="margin:20px 0 0;font-size:12px;line-height:21px;color:#57534e">TrainGrid is in invite-only early access. If you weren’t expecting this invitation, you can ignore it.</p>
<p style="margin:24px 0 0;font-size:12px;line-height:21px;color:#57534e">If the button doesn’t work, open:<br><a href="${href}" style="color:#9a4e24;word-break:break-all">${href}</a></p>
</td></tr><tr><td style="padding:20px;border-top:1px solid #e7e0d4;text-align:center;font-size:12px;line-height:20px;color:#57534e">TrainGrid &middot; A clear plan. Space to train.</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return { subject, preheader, html, text };
}
