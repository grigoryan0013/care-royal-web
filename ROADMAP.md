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
- **Status:** Not started. Foundation (GPS EVV capture) exists.

### 2. Embedded fintech beyond checkout
- **What:** (a) Instant / same-day caregiver pay (earned-wage access); (b) receivables financing (advance cash on unpaid invoices).
- **Why:** Per-transfer fee revenue on top of the checkout platform fee; instant pay is the #1 caregiver-retention lever.
- **Build:** Stripe Connect is already per-tenant (`tenants/{id}.stripeAccountId`, see `cloud-functions/index.js`). Add Stripe Instant Payouts + a `payouts` collection; compute advance from accrued gross (`/api/payroll`). Add a per-transfer fee.
- **Deps:** Stripe (already), Blaze plan. Financing needs a lending partner.
- **Status:** Payment rails coded (checkout + platform fee). Instant pay not started.

### 3. Telephony EVV / IVR clock-in
- **What:** Phone-based clock-in/out (caregiver calls a number, enters PIN + shift code).
- **Why:** Medicaid EVV requires a fallback for caregivers without smartphones.
- **Build:** Twilio number → webhook Cloud Function writes `clock_in`/`clock_out` to `shifts` (same actions as `app/lib/fb.ts` shifts handler).
- **Deps:** Twilio account.
- **Status:** Not started.

---

## Tier 2 — AI differentiators (buildable now against a real model)

### 4. AI layer (highest near-term differentiator)
- **What:** Care-plan generation from intake; visit-note summarization + risk flags (falls/pain trends across `shifts.notes`); auto-drafted family updates; voice/chat intake bot that turns a call into a `quoteRequests` doc.
- **Why:** The story that earns AI-premium multiples; incumbents are weak here.
- **Build:** Add an Anthropic-backed Cloud Function (key as a secret) or proxy; call from client via `apiPost`. Care-plan output feeds the `careplan` type in `components/DocStudio.tsx`. Note-summary reads completed `shifts`. Use the latest Claude model (see the `claude-api` skill / `CLAUDE.md`).
- **Deps:** `ANTHROPIC_API_KEY` secret, Blaze.
- **Status:** Heuristic seed only (booking "Suggest best match", template care-plan draft).

### 5. Scheduling optimization at scale
- **What:** Batch auto-schedule all open shifts (continuity of care, overtime avoidance, geography); caregiver shift-swap marketplace.
- **Build:** Extend `suggestBest` (in `app/agency/page.tsx` BookingDrawer) into a batch optimizer; add swap posting/claiming on top of the existing open-shift `claim` flow.
- **Deps:** None (heuristic) — optional AI assist from #4.
- **Status:** Single-shift suggestion exists.

---

## Tier 3 — Growth & network effects

### 6. Franchise / multi-location white-label
- **What:** Parent org over multiple tenants (org → locations); per-agency branding (logo, colors, custom domain); per-location billing.
- **Why:** Sells to networks (Home Instead, Comfort Keepers — hundreds of locations each); per-location expansion revenue; white-label makes it "their" product.
- **Build:** Add an `orgs`/parent layer above `tenants`; store branding on `tenants` and apply via CSS variables in `app/globals.css` + `components/PortalShell.tsx`. Extend the owner console (`app/owner/page.tsx`) to an org hierarchy + per-location billing.
- **Deps:** None to start; custom domains need hosting config.
- **Status:** Not started. Owner console + per-tenant model exist.

### 7. Background checks + credential verification (Checkr)
- **What:** On accepting a caregiver application (Recruiting), trigger a Checkr background check; track status; block scheduling until cleared.
- **Why:** Trust + compliance requirement; per-check markup revenue. Closes the recruiting loop already built.
- **Build:** Cloud Function calls Checkr on `caregiverApplications` accept; store status on `caregiverProfiles`; surface in Staff (`app/agency/page.tsx`).
- **Deps:** Checkr account.
- **Status:** Recruiting inbox built; verification not started.

### 8. Family "Care Journal"
- **What:** Photos + visit updates + a shared care timeline per household.
- **Why:** Emotional hook that drives reviews/referrals (feeds the `/care` microsite) → lower CAC.
- **Build:** `journal` collection (per household); caregiver posts on clock-out (`components`/caregiver portal), photo upload to Firebase Storage (add `storage.rules`); family timeline on family Home. Reuse review/microsite plumbing.
- **Deps:** Firebase Storage rules.
- **Status:** Not started. Reviews + microsite exist.

---

## Tier 4 — Stickiness & data

### 9. Anonymized benchmarking
- **What:** "Your fill rate / wages vs. agencies your size." Premium recurring add-on.
- **Why:** Data moat that compounds with every agency; recurring upsell.
- **Build:** Scheduled Cloud Function aggregates cross-tenant metrics into a no-PII `benchmarks` doc; surface "vs peers" in agency Reports (`app/agency/page.tsx` Reports).
- **Deps:** Blaze (scheduled function).
- **Status:** Per-agency reporting exists; benchmarking not started.

### 10. QuickBooks sync + audit report packs
- **What:** QuickBooks Online sync (invoices/payroll) per tenant; one-click state-audit report bundle (EVV logs + signed docs).
- **Why:** The "boring" integrations finance teams refuse to switch away from.
- **Build:** Intuit OAuth per tenant (Cloud Function); export `invoices`/payroll. Audit pack = print-to-PDF bundle (reuse `printDoc` pattern) of EVV + `documents` + `events`.
- **Deps:** Intuit developer account.
- **Status:** Not started. Invoices, docs, audit `events` exist.

---

## Suggested build order
1 (EVV export first) → 4 (AI layer) → 2 (instant pay) → 7 (Checkr) → 6 (white-label) → 8 (Care Journal) → 5 → 9 → 3 → 10 (full claims).
Fast, no-new-partner wins first: **4, 5, 6, 8**. Regulated/partner-gated: **1, 3, 7, 10** and the financing half of **2**.
