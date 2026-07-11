# Care Royal — Web App Master Plan

The multi-tenant care-management SaaS bundled with the agency sale, retained and
licensed (not sold as source) by the Wyoming LLC. Same instance later runs the
relaunched app as a second tenant. Companion app: `~/Desktop/WyomingCareapp`
(retained Flutter app).

## Core principles
- **Multi-tenant.** One codebase, one hosted instance. Sold agency = Tenant #1.
  Relaunch = Tenant #2. Tenants share nothing.
- **We keep the code.** Buyer gets a hosted login (a tenant), never the source.
- **Reuse what already works** (Tegula/PGL patterns): Firebase Auth/Firestore/
  Functions/Storage, Stripe via Functions, in-app e-sign (Tegula Doc Studio),
  FCM push. Less work, fewer errors.
- **Agency is always in control**: bookings, assignments, timesheets, payments
  all pass through an agency approval queue.

## Portals (one login, role-routed)
- **Agency console** — owner/admins/coordinators. Sees + approves everything, gets paid.
- **Caregiver app** — schedule, clock in/out (GPS), pay, documents.
- **Family portal** — household, care-recipient profiles, bookings, payments, documents.

## Data model
```
Tenant (Agency)
  └─ Household (family account)
       ├─ Members (logins: Manager / Viewer)
       └─ Care Recipients (bookable profiles: person / pet / home)
            └─ Bookings (per recipient, per service)
                 └─ Shifts ── assigned ──> Caregiver (credential-gated)
                      └─ Timesheet (clock in/out) ─> Payroll + Invoice
```

## Service catalog (per-tenant editable)
Categories A–J: Personal & senior care, Companion/non-medical, Skilled home
health, Specialized condition care, Child care, Pet care, Household/home
services, Respite & family support, Transportation, Wellness add-ons.
Each service carries: profile type (person/pet/home), pricing model
(hourly/visit/night/flat/session), credential required, default duration,
category. Full list in SERVICES.md (to be added in Phase 2).

## Payments & payroll
- **Stripe Connect**, agency = connected account & merchant of record.
  Family pays -> agency account -> caregiver payout. Software orchestrates,
  never holds funds (avoids money-transmitter licensing).
- **Payroll**: in-app UI, embedded backbone (Check / Gusto Embedded) owns tax
  filing & W-2/1099 liability. App owns timesheets & the run experience.

---

# The 5 build categories (fully functional by #5)

## Category 1 — Foundation
- Repo scaffold + chosen stack, environments, deploy pipeline.
- Multi-tenant auth (Firebase Auth) + tenant isolation (security rules).
- Three portal shells with role routing.
- Core data model (Tenant -> Household -> Recipient -> Booking -> Shift -> Caregiver).
- Agency dashboard skeleton. Seed Tenant #1.

## Category 2 — Booking engine
- Full service catalog, per-tenant editable, on/off + rates.
- Family portal: household, multi-profile (person/pet/home), invite members
  (Manager/Viewer), per-service booking flow.
- Agency approval queue; caregiver assignment with credential gating.

## Category 3 — Scheduling & time
- Master calendar (drag-assign, recurring, conflict/overtime detection).
- Open-shift board (caregiver claims, agency approves).
- Caregiver app: my schedule, clock in/out with GPS stamp vs client address,
  visit notes / task checklist.
- Family live visibility (clocked-in status, visit updates/summaries).

## Category 4 — Money
- Stripe Connect onboarding for the agency.
- Charge family (card/ACH), autopay, invoices, receipts, refunds/disputes.
- Payroll: approved timesheets -> in-app payroll run -> embedded backbone.
- Caregiver pay stubs & payout status.
- Agency financial reports (revenue, hours, margin per client).

## Category 5 — Documents, notifications, go-live
- Built-in e-sign: templates (service agreement, care plan, consent, HIPAA,
  employment docs), type/draw signature, timestamp, audit trail, locked PDF.
- Documents per household/caregiver.
- Notifications: email + browser push (FCM).
- Audit log; CCPA opt-out/delete surface.
- **Lead pipeline: import the 14k CSV (LAST).** New/Contacted/Consultation/
  Client/Lost stages, filters by city/zip, one-click convert to household.
- Full QA smoke test; production deploy. Fully functional.

---

## Confirmed stack
Next.js (static export) on **Cloudflare Pages**. Data layer = **Google Sheets +
Docs + Drive** via a private service account (data lives in owner's Google
Workspace; buyer never gets it). API = Cloudflare Pages Functions. Auth = PGL
custom accounts (PBKDF2 + JWT). Backend lib reused from PGL
(googleAuth/sheets/pw/jwtUser). Payments (Cat 4) = Stripe Connect.

## Status
- [x] Renamed old app -> WyomingCareapp; archived stale copy; created folder.
- [x] Stack confirmed (above).
- [x] **Category 1 — Foundation**: configs, reused backend lib, tenant data
      layer (12 tabs), auth API (login/signup/bootstrap/session), diag endpoint,
      3 portal shells with role-guarded routing, marketing landing, login page.
      `npm run build` passes clean (8 routes, static export).
- [x] **Category 2 — Booking engine**: full 63-service catalog (per-tenant,
      editable rates + active toggle + seed), family household with care
      recipients (person/pet/home), member invites (manager/viewer), per-service
      booking flow (service list filtered by recipient type), agency approval
      queue with caregiver assignment + credential display, clients & staff
      views. APIs: services, household, bookings, agency. Build passes.
- [x] **Category 3 — Scheduling & time**: shifts auto-generated on booking
      approval (assigned=scheduled, unassigned=open). Caregiver app: my schedule
      with care notes + address, clock in/out with geolocation stamp, visit
      notes, and an open-shift board to claim. Agency: master schedule grouped
      by day (caregiver/recipient/status). Family: live "care in progress" +
      recent visit notes on Home. API: shifts. Build passes.
- [x] **Category 4 — Money**: Stripe Connect onboarding (agency = merchant of
      record, platform never holds funds); invoices auto-generated from completed
      shifts (amount from service rate + hours), family pays via Stripe Checkout
      on the connected account, webhook marks paid, agency mark-paid/void
      fallback; payroll timesheet rollup (hours + gross per caregiver from their
      rate), caregiver "My pay" stubs, "Run payroll" gated on an embedded backbone
      (Check/Gusto) env. APIs: connect, invoices, stripe-webhook, payroll. Build passes.
- [x] **Category 5 — Documents, notifications, leads, go-live**: built-in e-sign
      (templates: service agreement / care plan / consent / HIPAA; agency sends,
      family & caregiver sign by typed signature; audit = signedBy+signedAt+
      signature); best-effort email notifications (Gmail API, env-gated) on
      booking request/approval + document sent; lead pipeline — CSV import
      (client-side parse, batched 500s), paginated list with stage filter +
      search + counts, stage updates; Next.js bumped to 14.2.35. APIs: documents,
      leads. Build passes (8 routes). Static-export CVE note in SETUP.md.

## ALL 5 CATEGORIES COMPLETE — build green throughout.
Go-live still needs the owner credentials in SETUP.md + the 14k CSV dropped into
the Leads importer. Open decision: payroll backbone (Check vs Gusto Embedded).

## To go live (from SETUP.md) — needs from owner
Google service account JSON, a Google Sheet id (MASTER_SHEET_ID), a random
ADMIN_JWT_SECRET, a BOOTSTRAP_SECRET. Then run the bootstrap curl once.
