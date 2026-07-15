# Care Royal — Transactional email (Gmail API, Tegula pattern)

Care Royal sends branded HTML emails through the **Gmail API using a
domain-wide-delegated service account** that impersonates `info@thecareroyal.com`
— the exact pattern Tegula Stone uses (no SMTP, no app passwords). Keeps Firebase
as the only backend (it runs in `cloud-functions/`).

## Good news: delegation is already set up
Tegula's Gmail service account **already impersonates `info@thecareroyal.com`**
with the `gmail.send` scope (its domain-wide delegation is authorized on the
`thecareroyal.com` Workspace). So you can reuse the **same service-account JSON** —
no new Google Workspace admin steps.

## Setup (one time)
Requires the Firebase **Blaze** plan.
```bash
cd ~/Desktop/CareRoyal/cloud-functions && npm install
cd ~/Desktop/CareRoyal
# Paste the SAME GMAIL_SERVICE_ACCOUNT JSON you use for Tegula (one line):
firebase functions:secrets:set GMAIL_SERVICE_ACCOUNT
firebase deploy --only functions --project care-royale2-4dgwu0
```
If for some reason delegation is NOT yet granted for this SA: in Google Workspace
Admin → Security → API controls → Domain-wide delegation, add the SA client ID
with scope `https://www.googleapis.com/auth/gmail.send`.

## What sends automatically (Firestore triggers)
- **New quote request** → acknowledgement to the client + notification to the agency owner.
- **New caregiver application** → acknowledgement to the applicant + notification to the agency owner.
- **Booking confirmed** (status → scheduled) → confirmation to the family + "new shift" to the assigned caregiver.

All emails are branded with the agency's name ("{Agency} via Care Royal") and
sent from `info@thecareroyal.com`. Templates live in `baseEmail()` in
`cloud-functions/index.js` — edit there to restyle.

## Verify
Call the `emailTest` callable while signed in as an agency admin (or add a button
that invokes it) — it sends a test to your account and confirms delegation works.

## Adding more emails
Add a Firestore trigger (e.g. `onDocumentUpdated("invoices/{id}", …)` for
"invoice ready") or call `transporter()` from any function. SMS is a future add
(Twilio) using the same trigger points.
