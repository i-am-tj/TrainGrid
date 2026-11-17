# Invitation email setup (Resend + Namecheap DNS)

TrainGrid sends invitation emails through [Resend](https://resend.com)'s HTTP API. No SDK is
installed: `lib/email/resend.ts` makes one `fetch` per email, with a 10-second timeout and an
idempotency key. Until the variables below are set, invitations work exactly as before and the
admin page says plainly that **no email is sent**.

What the admin sees, and what it means:

| Status in the list | Meaning |
| --- | --- |
| Email not sent | No send was requested for this invitation. |
| Email sending… | A send is in flight; a second one is refused. |
| Email accepted by provider · time | Resend accepted the request. **Not** proof it reached the inbox. |
| Email failed · time · invitation still valid | The send failed; the invitation is untouched. Retry, or share the link. |

Rules (enforced in the database by `begin_invitation_email()`): only live, unaccepted invitations
are emailed, always to the invitation's own stored address; one send at a time per invitation;
no resend within a minute of an accepted one; at most five attempts per invitation per 24 hours.

## 1. Create the Resend account and add your domain

1. Sign up at resend.com.
2. **Domains → Add domain.** Use a **subdomain** of the domain you own, for example
   `mail.yourdomain.com`. Sending from a subdomain keeps the reputation of invitation mail
   separate from any personal mail on the root domain. (The root domain also works.)
3. Pick the **region** nearest your users (for Australia, Tokyo `ap-northeast-1` is closest).
4. Resend now shows the DNS records to add — usually:

   | Type | Name shown by Resend | Value (example; copy yours exactly) | Priority |
   | --- | --- | --- | --- |
   | MX | `send.mail` | `feedback-smtp.<region>.amazonses.com` | 10 |
   | TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | — |
   | TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSq…` (long DKIM key) | — |

   Keep this page open; you will copy each value into Namecheap.

## 2. Add the records in Namecheap

1. Namecheap → **Domain List** → **Manage** next to your domain → **Advanced DNS**.
2. **Host field:** Namecheap adds your domain automatically, so enter only the part Resend shows
   before your domain — e.g. `send.mail`, not `send.mail.yourdomain.com`. Entering the full name
   creates `send.mail.yourdomain.com.yourdomain.com` and verification fails.
3. **TXT records** — under *Host Records* → **Add New Record** → *TXT Record*:
   - Host `send.mail`, Value `v=spf1 include:amazonses.com ~all`, TTL Automatic.
   - Host `resend._domainkey.mail`, Value: the full DKIM key from Resend (no quotes, no line
     breaks), TTL Automatic.
4. **MX record** — MX records live under *Mail Settings* on the same page:
   - Set *Mail Settings* to **Custom MX**, then **Add New Record**: Host `send.mail`, Value
     `feedback-smtp.<region>.amazonses.com`, Priority `10`.
   - ⚠️ If the domain currently uses Namecheap **Email Forwarding** or **Private Email** for your
     own inbox, switching to *Custom MX* replaces those settings. Before switching, note the
     existing root MX records (Namecheap's help page for your mail product lists them) and add
     them back as Custom MX entries with Host `@`, so your personal mail keeps working. The
     Resend MX is on `send.mail`, so it never conflicts with mail for the root domain.
5. **DMARC (recommended):** add a TXT record, Host `_dmarc`, Value
   `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`. `p=none` only reports; tighten it to
   `quarantine` once mail is verified as passing. Skip this if a `_dmarc` record already exists.
6. Click the ✓ to save each record. Back in Resend, press **Verify DNS records**. Namecheap
   usually propagates within minutes; it can take up to 48 hours. Until every record shows
   *Verified*, Resend refuses to send from the domain (the admin page will report a failed send).

## 3. Create an API key

Resend → **API Keys → Create API key**: permission **Sending access**, domain: the one you just
verified. Copy the key (it starts with `re_`); Resend shows it once.

## 4. Configure Vercel

Vercel → Project → **Settings → Environment Variables**, scope **Production** (add them to
Preview only if you want previews to send real mail):

| Variable | Value | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_…` | Mark as **Sensitive**. Server only; never `NEXT_PUBLIC_`. |
| `TRAINGRID_EMAIL_FROM` | `TrainGrid <invites@mail.yourdomain.com>` | Must be on the verified domain. |
| `TRAINGRID_EMAIL_REPLY_TO` | `you@yourdomain.com` | Optional. Where replies go. |
| `TRAINGRID_SITE_URL` | `https://train-grid.vercel.app` (or your custom domain) | The sign-in link in every email and the canonical URL. Without it, Vercel's production domain is used. |
| `TRAINGRID_DEFAULT_TIME_ZONE` | `Australia/Sydney` | Optional. Used only before a browser has reported its own zone. |

Redeploy (Deployments → … → **Redeploy**) so the new variables take effect.

## 5. Check it end to end

1. Sign in as an admin → **Invitations**.
2. Invite **`delivered@resend.dev`** with *Email the invitation* ticked. This is Resend's test
   inbox: it accepts the message without emailing anyone. The list should show *Email accepted by
   provider*, and Resend → **Emails** should list it as delivered.
3. Invite a real address of yours and check the message in Gmail, Outlook and Apple Mail (light
   and dark mode): logo, button, the plain-text link and the invited address. Only after this
   check should email delivery be called verified.
4. Revoke the test invitations afterwards.

## Troubleshooting

| What you see | Likely cause |
| --- | --- |
| Admin page says "No email is sent" | A variable is missing or malformed: the key must start with `re_`, the From must be `Name <addr>` or a bare address, and redeploy after changing variables. |
| "The email couldn't be sent" | Domain not verified yet, or the key lacks access to that domain. Resend → Emails / Logs shows why. The invitation itself is still valid. |
| "The email service is busy" | Resend rate limit; wait a few minutes and use **Resend email**. |
| Mail lands in spam | Add DMARC (step 2.5); make sure SPF and DKIM show *Verified* in Resend. |

Never paste the API key into a ticket, chat or commit. Rotate it in Resend if it is ever exposed.
