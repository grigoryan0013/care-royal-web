# Care Royal — Value Roadmap (the "million-dollar" backlog)

This is the prioritized backlog to take Care Royal from a working agency SaaS to a
high-valuation product. Each item lists **what**, **why it's worth money**, **where/how
to build it in this codebase**, **dependencies**, and **status**.

> How to work in this repo (read `CLAUDE.md` first): every feature = add to the
> Firestore data layer `app/lib/fb.ts` **and** mirror it in the demo mock
> `app/lib/demo.ts`, add/adjust `firestore.rules` (then `firebase deploy --only
> firestore:rules`), build the UI, and keep `npm run build` green. Server-side work
> (payments/email/AI/Twilio) goes in `cloud-functions/` (Firebase is the only backend).
> Verify rules against the live project with REST before shipping.

---

## Tier 1 — Revenue moats (biggest valuation unlock)

### 1. EVV + Medicaid/insurance claims
- **What:** Electronic Visit Verification export to state aggregators (HHAeXchange, Sandata, Tellus) + claim generation (CMS-1500 / 837P) from completed shifts.
- **Why:** Most agency revenue is Medicaid/VA/LTC-insurance billed; the 21st Century Cures Act mandates EVV. Unlocks the largest agency segment (that we can't serve today) and is nearly impossible to rip out.
- **Build:** GPS clock-in/out already captured on `shifts` (gpsIn/gpsOut). Add `payers` + `authorizations` collections; per-service billing codes/rates on `services`. New `cloud-functions` exporters per state format; a claims builder (PDF/EDI). Start with EVV CSV export, then claims.
- **Deps:** State EVV aggregator accounts/specs; clearinghouse for 837. Regulated — scope carefully.
- **Status:** BUILT. payers + authorizations + claims collections, EVV CSV export from GPS-verified shifts, CMS-1500-style claim generation, billing codes on services, agency "Billing & EVV" console. Cloud claims export per state format is the remaining partner-gated piece.

### 2. Embedded fintech beyond checkout
- **What:** (a) Instant / same-day caregiver pay (earned-wage access); (b) receivables financing (advance cash on unpaid invoices).
- **Why:** Per-transfer fee revenue on top of the checkout platform fee; instant pay is the #1 caregiver-retention lever.
- **Build:** Stripe Connect is already per-tenant (`tenants/{id}.stripeAccountId`, see `cloud-functions/index.js`). Add Stripe Instant Payouts + a `payouts` collection; compute advance from accrued gross (`/api/payroll`). Add a per-transfer fee.
- **Deps:** Stripe (already), Blaze plan. Financing needs a lending partner.
- **Status:** BUILT (instant pay). payouts collection + earned-wage cash-out with per-transfer fee; caregiver cash-out UI + agency payouts view; instantPayout Cloud Function (Stripe transfers, inert until caregiver payout destinations connected). Receivables financing still needs a lending partner.

### 3. Telephony EVV / IVR clock-in
- **What:** Phone-based clock-in/out (caregiver calls a number, enters PIN + shift code).
- **Why:** Medicaid EVV requires a fallback for caregivers without smartphones.
- **Build:** Twilio number → webhook Cloud Function writes `clock_in`/`clock_out` to `shifts` (same actions as `app/lib/fb.ts` shifts handler).
- **Deps:** Twilio account.
- **Status:** BUILT. ivrWebhook Cloud Function (Twilio TwiML: PIN + shift code -> clock_in/out); caregiver PIN + per-shift codes surfaced in the portal. Needs a Twilio number pointed at the webhook to go live.

---

## Tier 2 — AI differentiators (buildable now against a real model)

### 4. AI layer (highest near-term differentiator)
- **What:** Care-plan generation from intake; visit-note summarization + risk flags (falls/pain trends across `shifts.notes`); auto-drafted family updates; voice/chat intake bot that turns a call into a `quoteRequests` doc.
- **Why:** The story that earns AI-premium multiples; incumbents are weak here.
- **Build:** Add an Anthropic-backed Cloud Function (key as a secret) or proxy; call from client via `apiPost`. Care-plan output feeds the `careplan` type in `components/DocStudio.tsx`. Note-summary reads completed `shifts`. Use the latest Claude model (see the `claude-api` skill / `CLAUDE.md`).
- **Deps:** `ANTHROPIC_API_KEY` secret, Blaze.
- **Status:** BUILT. aiGenerate Cloud Function (Anthropic claude-opus-4-8, adaptive thinking): care-plan gen, note summarization + risk flags, family updates, intake; agency "AI assistant" console; heuristic fallback until ANTHROPIC_API_KEY is set.

### 5. Scheduling optimization at scale
- **What:** Batch auto-schedule all open shifts (continuity of care, overtime avoidance, geography); caregiver shift-swap marketplace.
- **Build:** Extend `suggestBest` (in `app/agency/page.tsx` BookingDrawer) into a batch optimizer; add swap posting/claiming on top of the existing open-shift `claim` flow.
- **Deps:** None (heuristic) — optional AI assist from #4.
- **Status:** BUILT. Batch auto-assign optimizer (continuity, overtime avoidance, availability, credential match) + shiftSwaps marketplace (caregivers post/claim); agency "Auto-assign open shifts" + caregiver swap board.

---

## Tier 3 — Growth & network effects

### 6. Franchise / multi-location white-label
- **What:** Parent org over multiple tenants (org → locations); per-agency branding (logo, colors, custom domain); per-location billing.
- **Why:** Sells to networks (Home Instead, Comfort Keepers — hundreds of locations each); per-location expansion revenue; white-label makes it "their" product.
- **Build:** Add an `orgs`/parent layer above `tenants`; store branding on `tenants` and apply via CSS variables in `app/globals.css` + `components/PortalShell.tsx`. Extend the owner console (`app/owner/page.tsx`) to an org hierarchy + per-location billing.
- **Deps:** None to start; custom domains need hosting config.
- **Status:** BUILT. orgs parent layer + per-tenant branding (logo/colors/name/domain) applied live in PortalShell; agency "Grow & brand" console with multi-location. Custom-domain DNS is the remaining hosting step.

### 7. Background checks + credential verification (Checkr)
- **What:** On accepting a caregiver application (Recruiting), trigger a Checkr background check; track status; block scheduling until cleared.
- **Why:** Trust + compliance requirement; per-check markup revenue. Closes the recruiting loop already built.
- **Build:** Cloud Function calls Checkr on `caregiverApplications` accept; store status on `caregiverProfiles`; surface in Staff (`app/agency/page.tsx`).
- **Deps:** Checkr account.
- **Status:** BUILT. checkrInvite/checkrStatus Cloud Functions + bgCheckStatus on profiles; Staff "Run check" control with status badges. Needs a Checkr account (CHECKR_API_KEY) to run real checks.

### 8. Family "Care Journal"
- **What:** Photos + visit updates + a shared care timeline per household.
- **Why:** Emotional hook that drives reviews/referrals (feeds the `/care` microsite) → lower CAC.
- **Build:** `journal` collection (per household); caregiver posts on clock-out (`components`/caregiver portal), photo upload to Firebase Storage (add `storage.rules`); family timeline on family Home. Reuse review/microsite plumbing.
- **Deps:** Firebase Storage rules.
- **Status:** BUILT. journal collection + storage.rules for photos; caregivers post on clock-out, family "Care Journal" timeline.

---

## Tier 4 — Stickiness & data

### 9. Anonymized benchmarking
- **What:** "Your fill rate / wages vs. agencies your size." Premium recurring add-on.
- **Why:** Data moat that compounds with every agency; recurring upsell.
- **Build:** Scheduled Cloud Function aggregates cross-tenant metrics into a no-PII `benchmarks` doc; surface "vs peers" in agency Reports (`app/agency/page.tsx` Reports).
- **Deps:** Blaze (scheduled function).
- **Status:** BUILT. Scheduled benchmarkAggregate Cloud Function -> no-PII benchmarks/global doc; agency "Benchmarks" vs-peers view.

### 10. QuickBooks sync + audit report packs
- **What:** QuickBooks Online sync (invoices/payroll) per tenant; one-click state-audit report bundle (EVV logs + signed docs).
- **Why:** The "boring" integrations finance teams refuse to switch away from.
- **Build:** Intuit OAuth per tenant (Cloud Function); export `invoices`/payroll. Audit pack = print-to-PDF bundle (reuse `printDoc` pattern) of EVV + `documents` + `events`.
- **Deps:** Intuit developer account.
- **Status:** BUILT. quickbooksConnect/Status/Sync Cloud Functions (Intuit OAuth, inert until credentials) + one-click state audit pack (EVV + signed docs + claims + activity) via print. Needs an Intuit developer account to sync.

---

## Suggested build order
1 (EVV export first) → 4 (AI layer) → 2 (instant pay) → 7 (Checkr) → 6 (white-label) → 8 (Care Journal) → 5 → 9 → 3 → 10 (full claims).
Fast, no-new-partner wins first: **4, 5, 6, 8**. Regulated/partner-gated: **1, 3, 7, 10** and the financing half of **2**.

---

## Go-live checklist for the shipped features

All 10 items are built into the app + `cloud-functions/`. Each stays inert (graceful
fallback in `app/lib/fb.ts`) until its account/secret is configured — the UI works today
in demo mode and against Firestore.

Deploy:
- `firebase deploy --only firestore:rules --project care-royale2-4dgwu0` (new collections: payers, authorizations, claims, payouts, shiftSwaps, orgs, journal, benchmarks)
- `firebase deploy --only storage --project care-royale2-4dgwu0` (Care Journal photos — `storage.rules`)
- `cd cloud-functions && npm install && firebase deploy --only functions` (needs Blaze)

Secrets (set with `firebase functions:secrets:set NAME`), each enables one feature:
- `ANTHROPIC_API_KEY` — item 4 (AI). Uses `claude-opus-4-8`.
- `CHECKR_API_KEY` — item 7 (background checks).
- `INTUIT_CLIENT_ID` / `INTUIT_CLIENT_SECRET` — item 10 (QuickBooks OAuth).
- Existing `STRIPE_SECRET_KEY` also powers item 2 instant payouts (caregiver Stripe payout destinations needed).

Partner setup (no code changes):
- Item 3 (IVR): point a Twilio phone number's voice webhook at the deployed `ivrWebhook` URL.
- Item 1 (claims): per-state EVV aggregator (HHAeXchange/Sandata/Tellus) + 837 clearinghouse for electronic submission; CSV export + CMS-1500 print work today.
- Item 9 (benchmarking): `benchmarkAggregate` runs every 24h once functions are deployed.
