# Care Royal — Transactional email (Gmail API, Tegula pattern)

Care Royal sends branded HTML emails through the **Gmail API using a
domain-wide-delegated service account** that impersonates `info@thecareroyal.com`
— the exact technique Tegula Stone uses (no SMTP, no app passwords).

## Where it runs: Cloudflare Pages Function (NOT Firebase)
Email lives in **`functions/api/email.js`**, a Cloudflare Pages Function that ships
with the static site. We deliberately do **not** use Firebase Cloud Functions:
those require the Blaze billing plan, and the `care-royale2-4dgwu0` project is on
Spark (no billing) — that's the wall we hit. Cloudflare lets us use any credential
we want, so it's the same setup as Tegula (which also runs on Cloudflare).

Because Cloudflare Workers have no Node runtime, `email.js` signs the
service-account JWT with **Web Crypto** and calls the Gmail REST API directly
(instead of Tegula's `googleapis` + `nodemailer`). The credential and the
domain-wide delegation are identical.

> The old Firebase implementation is kept in `cloud-functions/index.js` for
> reference (and for Stripe, which still targets Firebase Functions if ever
> deployed), but the email triggers there are superseded by `functions/api/email.js`.

## Delegation is already set up
Tegula's Gmail service account **already impersonates `info@thecareroyal.com`**
with the `gmail.send` scope (domain-wide delegation authorized on the
`thecareroyal.com` Workspace). Reuse the **same service-account JSON** — no new
Google Workspace admin steps. (If ever needed: Workspace Admin → Security → API
controls → Domain-wide delegation, add the SA client ID with scope
`https://www.googleapis.com/auth/gmail.send`.)

## Setup (one time) — one Cloudflare secret
Cloudflare dashboard → the Care Royal Pages project → **Settings → Variables and
Secrets** → add an **encrypted secret** (not plaintext):

    Name:  GMAIL_SERVICE_ACCOUNT
    Value: the one-line Gmail service-account JSON (the same one Tegula uses)

Redeploy (or push) so the secret is bound. Until it's set, `/api/email` no-ops
and every form still works.

## What sends automatically
The client fires `POST /api/email` right after the Firestore write (see
`sendEmail()` in `app/lib/fb.ts`):
- **New quote request** (`/quote`) → acknowledgement to the client + notification to the agency.
- **New caregiver application** (`/apply`) → acknowledgement to the applicant + notification to the agency.
- **Booking confirmed** (agency approves → status `scheduled`) → confirmation to the family + "new shift" to the assigned caregiver.

Agency routing: the agency's notification address is stored as `notifyEmail` on
the public `joinCodes/{code}` doc at signup (`app/lib/session.ts`), so the public
forms can reach it without a server-side Firestore read.

All emails are branded with the agency's name ("{Agency} via Care Royal") and
sent from `info@thecareroyal.com`. Templates live in `composeMessages()` /
`baseEmail()` in `functions/api/email.js` — edit there to restyle.

## Verify
`POST /api/email {"type":"test","to":"you@example.com"}` — sends a test and
confirms delegation. Example:

```bash
curl -X POST https://<your-pages-domain>/api/email \
  -H 'Content-Type: application/json' \
  -d '{"type":"test","to":"you@example.com"}'
```

## Adding more emails
Add a `type` to `composeMessages()` in `functions/api/email.js` and call
`sendEmail({ type, ... })` from the relevant place in `app/lib/fb.ts`, or POST
`{"type":"custom","to","subject","html"}`. SMS is a future add (Twilio) at the
same call sites.
