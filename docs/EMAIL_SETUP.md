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
2. **Domains → Add domain.** Use a **subdomain** of the domain you own. TrainGrid uses
   `traingrid.iamtj.dev`. Sending from a subdomain keeps the reputation of invitation mail
   separate from any personal mail on the root domain.
3. Pick the **region** nearest your users (for Australia, Tokyo `ap-northeast-1` is closest).
4. Resend now shows the DNS records to add. For `traingrid.iamtj.dev` they are:

   | Section in Resend | Type | Host (enter in Namecheap) | Value |
   | --- | --- | --- | --- |
   | DKIM | **TXT** | `resend._domainkey.traingrid` | `p=MIGfMA…` (long key) |
   | Enable Sending · SPF | **CNAME** | `rsend.traingrid` | `rsend-ap…mta.net` |
   | Enable Sending · SPF | **CNAME** | `send.traingrid` | `send.for…mta.net` |
   | DMARC (recommended) | **TXT** | `_dmarc` | `v=DMARC1; p=none;` |

   Resend's table truncates long hosts and values (`resend._[…]aingrid`, `rsend-ap[…]mta.net`).
   **Click each one to copy it in full**; never type it from the screen.

   **There is no MX record.** Resend's current setup handles bounces through the two CNAMEs, which
   also carry SPF. An MX record is only needed if you turn on *receiving* mail at the domain,
   which TrainGrid does not use. (Older Resend guides show an MX plus an SPF TXT on `send`; that
   is the previous format.)

## 2. Add the records in Namecheap

1. Namecheap → **Domain List** → **Manage** next to `iamtj.dev` → **Advanced DNS** → *Host
   Records* → **Add New Record**.
2. **Host field:** Namecheap adds `iamtj.dev` automatically, so enter only the part before it —
   `send.traingrid`, not `send.traingrid.iamtj.dev`. Entering the full name creates
   `send.traingrid.iamtj.dev.iamtj.dev` and verification fails.
3. Add each record from the table above with **TTL Automatic**:
   - **TXT Record**, Host `resend._domainkey.traingrid`, Value: the full DKIM key (no quotes, no
     line breaks).
   - **CNAME Record**, Host `rsend.traingrid`, Value: the full target from Resend. Paste it without
     `https://`; a trailing dot is fine.
   - **CNAME Record**, Host `send.traingrid`, Value: the full target from Resend.
   - **TXT Record**, Host `_dmarc`, Value `v=DMARC1; p=none;`. This record sits on the root
     domain and covers all of `iamtj.dev`, including this subdomain; `p=none` only reports. If a
     `_dmarc` record already exists, keep it and skip this one. To limit DMARC to TrainGrid mail
     only, use Host `_dmarc.traingrid` instead.
4. **A CNAME host can have no other record.** If `rsend.traingrid` or `send.traingrid` already has
   a TXT or MX record (for example, from the older setup), delete it before adding the CNAME.
5. **Leave *Mail Settings* alone.** No MX is needed, so there is no reason to switch to *Custom
   MX*, and any Email Forwarding or Private Email on `iamtj.dev` keeps working.
6. Click the ✓ to save each record. Back in Resend, press **Verify DNS records**. Namecheap
   usually propagates within minutes; it can take up to 48 hours. Until every record shows
   *Verified*, Resend refuses to send from the domain (the admin page will report a failed send).

## 3. Create an API key

Resend → **API Keys → Create API key**: permission **Sending access**, domain
`traingrid.iamtj.dev`. Copy the key (it starts with `re_`); Resend shows it once.

## 4. Configure Vercel

Vercel → Project → **Settings → Environment Variables**, scope **Production** (add them to
Preview only if you want previews to send real mail):

| Variable | Value | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_…` | Mark as **Sensitive**. Server only; never `NEXT_PUBLIC_`. |
| `TRAINGRID_EMAIL_FROM` | `TrainGrid Invites <invites@traingrid.iamtj.dev>` | Must be on the verified domain. `Name <address>` or a bare address; the space before `<` is optional. |
| `TRAINGRID_EMAIL_REPLY_TO` | an inbox you read | Optional. Where replies go. |
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
| Admin page says "No email is sent" | A variable is missing or malformed: the key must start with `re_`, the From must be `Name <addr>` (or `Name<addr>`) or a bare address, and redeploy after changing variables. |
| "The email couldn't be sent" | Domain not verified yet, or the key lacks access to that domain. Resend → Emails / Logs shows why. The invitation itself is still valid. |
| "The email service is busy" | Resend rate limit; wait a few minutes and use **Resend email**. |
| Mail lands in spam | Add DMARC (step 2.3); make sure DKIM and both SPF CNAMEs show *Verified* in Resend. |
| A record stays *Pending* | Host entered with the domain appended, a truncated value pasted, or another record on the same CNAME host. Check with `dig +short CNAME send.traingrid.iamtj.dev`. |

Never paste the API key into a ticket, chat or commit. Rotate it in Resend if it is ever exposed.
