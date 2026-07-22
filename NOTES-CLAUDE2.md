# Handoff notes — security review pass (for the second Claude account)

Date: 2026-07-22. Repo: `~/Desktop/CareRoyal` (Next.js SaaS, deploys under `/app`).
Read `CLAUDE.md` + `ROADMAP.md` first. This file records the security-review pass that
was in progress so you can pick up without re-deriving it.

## What triggered this
Three parallel review agents (payments/webhooks, Firestore rules/security, data
layer/frontend) audited the launch. They surfaced several live, exploitable issues.
The full agent transcripts were NOT persisted — if you need the complete lower-severity
list, re-run `/security-review` and `/code-review` on the working tree.

## Critical fixes APPLIED (in the working tree — see "Deploy" below for what still ships)

1. **Cross-tenant takeover (C2)** — `firestore.rules`
   - Any signed-in user could self-provision as a `manager` of any agency (join codes
     were enumerable and `isAgency()` didn't check approval status), gaining read/write
     to that tenant's data incl. client PHI.
   - Fix: added `isActive()` (status == 'active', missing → active so owners still pass);
     `isAgency()` now requires `isActive()`. `joinCodes`: `get` allowed, `list` denied.

2. **Payment hijack + tenant self-activation (H2/M5)** — `firestore.rules`
   - Tenant `update` was open to any agency member. A member could redirect family
     payments to their own Stripe, or flip their own tenant from pending → active.
   - Fix: tenant `update` is now owner-only and FREEZES `stripeAccountId`, `qboConnected`,
     `payrollProvider`, `status` against client writes (server/Admin SDK only). Tenant
     `create` forces `status == 'pending'` (super-admin exempt for owner self-provision).

3. **Caregiver self-escalation (H3)** — `firestore.rules` + `app/lib/fb.ts`
   - `/api/profile` let a caregiver set their own `rate` and `pin`, and rules let them
     write vetting fields. A caregiver could inflate pay or self-clear a background check.
   - Fix: rules freeze `rate`, `bgCheckStatus`, `bgCheckId`, `stripeAccountId`, `pin` on
     caregiver self-writes (agency writes anything). `fb.ts` `/api/profile` now only
     accepts `credentials`, `credentialExpiry`, `bio`, `availability` from caregivers.

4. **Instant-payout drain (payments)** — `cloud-functions/index.js` `instantPayout`
   - The payout doc's `gross`/`net` are client-written (rules only check `caregiverId`),
     so trusting them still allowed draining the Stripe balance with a forged doc.
   - Fix: `instantPayout` now recomputes the caregiver's true available balance
     server-side (completed-shift earnings − other non-failed payouts), caps the
     transfer to it, transfers `net` only, and overwrites the doc's gross/fee/net with
     the server-verified values on success. `payouts` create rule also forces
     `status == 'pending'` (defense-in-depth).

5. **QuickBooks double-post (payments)** — `cloud-functions/index.js` `quickbooksSync`
   - Re-running sync re-POSTed every unpaid invoice → duplicates in QuickBooks.
   - Fix: skip invoices where `qboSynced` is already true.

## Pricing / billing wired
- `app/lib/plans.ts`: Standard price set to **$49** (was $50) to match the Stripe link;
  `PAYMENT_LINKS` populated with the owner-provided Stripe Payment Links:
  standard `dRm5kC10x247gsn6ApcV20g`, pro `dRmfZgbFb5gj0tp1g5cV20j`,
  enterprise `00w4gy4cJ9wz6RNbUJcV20i`.
- `app/agency/page.tsx` plan card now shows an "Activate <Plan> — $X/mo" button linking
  to the tenant's plan payment link. Signup itself is still free-trial / no-card.

## Verification done
- `NEXT_PUBLIC_BASE_PATH=/app npm run build` → green (19/19 pages).
- `node --check cloud-functions/index.js` → OK.
- Rule changes checked for backward-compat: existing owners have no `status` field and
  default active; `fb.ts` cash_out already writes `status: "pending"`; owner tenant edits
  don't touch the frozen fields.

## Deploy — NOT all shipped yet
- **Frontend (`/app`)**: ships via `~/Desktop/WyomingCareapp/deploy-with-app.sh` (auto).
- **Firestore rules**: `firebase deploy --only firestore:rules --project care-royale2-4dgwu0`.
  Per the security memory, verify against the live project with REST (positive + negative
  case) before declaring done. **The rule fixes only protect prod once this is deployed.**
- **Cloud Functions** (`instantPayout`, `quickbooksSync`): **DEPLOYED to prod** (Blaze is
  on). Both are ACTIVE GEN_2 in `us-central1`. `instantPayout` was a new deploy (rev 00001);
  `quickbooksSync` was redeployed with the fix. Deploy recipe (default compute SA was
  deleted, so use gcloud with the project SA as build+run SA):
  ```
  CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.12 gcloud functions deploy <NAME> \
    --project care-royale2-4dgwu0 --gen2 --region us-central1 \
    --runtime nodejs20 --source cloud-functions --entry-point <NAME> \
    --trigger-http --allow-unauthenticated \
    --run-service-account care-royale2-4dgwu0@care-royale2-4dgwu0.iam.gserviceaccount.com \
    --build-service-account projects/care-royale2-4dgwu0/serviceAccounts/care-royale2-4dgwu0@care-royale2-4dgwu0.iam.gserviceaccount.com \
    --set-secrets <SECRETS>
  ```
  Secrets: instantPayout → `STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest`;
  quickbooksSync → `INTUIT_CLIENT_ID=INTUIT_CLIENT_ID:latest,INTUIT_CLIENT_SECRET=INTUIT_CLIENT_SECRET:latest`.
  onCall functions deploy `--allow-unauthenticated` (allUsers invoker) — the Firebase
  callable SDK verifies the auth token inside `ctx(request)`.

## Suggested next steps
- Deploy the Firestore rules (highest priority — the takeover/hijack fixes are inert until then).
- Re-run `/security-review` for the lower-severity findings not captured here.
- Confirm the Stripe Payment Links' success URL returns to the app portal.
