# Care Royal — Payments (Stripe Connect on Firebase Functions)

Payments keep Firebase as the only backend: the secret Stripe key lives in
Firebase Cloud Functions (`cloud-functions/`), never in the client. Until you
deploy them, the app degrades gracefully ("payments coming soon" / families see
"your agency will mark this paid"). Once deployed, the same buttons go live — no
client change needed (the client already calls the callables in `app/lib/fb.ts`).

## What it does
- **connectOnboard** — creates a Stripe Express account for the agency and returns an onboarding link (Money → "Connect payments").
- **connectStatus** — reports whether the agency can accept charges.
- **createCheckout** — a family paying an invoice gets a Stripe Checkout URL; funds go to the agency (2% application fee, adjustable in `index.js`).
- **stripeWebhook** — marks the invoice paid on `checkout.session.completed`.

## One-time setup
Requires the Firebase **Blaze** plan (Cloud Functions need it).

```bash
cd ~/Desktop/CareRoyal/cloud-functions && npm install
cd ~/Desktop/CareRoyal

# 1. Set the two secrets (paste values when prompted)
firebase functions:secrets:set STRIPE_SECRET_KEY        # sk_live_... or sk_test_...
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET    # whsec_... (from step 3)

# 2. Deploy the functions
firebase deploy --only functions --project care-royale2-4dgwu0
```

3. In the **Stripe dashboard → Developers → Webhooks**, add an endpoint pointing
   at the deployed `stripeWebhook` URL (shown after deploy), subscribed to
   `checkout.session.completed`. Copy its signing secret into
   `STRIPE_WEBHOOK_SECRET` (step 1) and redeploy.

4. Enable **Stripe Connect** on your Stripe account (Express accounts).

## Notes
- `APP_URL` in `cloud-functions/index.js` is the return/success base URL — set it to your live domain.
- The client region is Functions default (`us-central1`); change both sides together if you relocate.

## Payroll — each agency connects its OWN Gusto
Care Royal is multi-tenant: every agency connects its own payroll provider so
payouts and payroll taxes run under **their** account — the platform never holds
funds. The UI is live (Money → Payroll → "Connect Gusto"); it stores
`tenants/{id}.payrollProvider` and gross pay is computed from timesheets.

To make it a real Gusto connection (OAuth + running payrolls via the Gusto API),
become a Gusto embedded/partner developer, then in `cloud-functions/index.js`
extend `payrollConnect` to return a Gusto authorize URL and add a callback +
`runPayroll` function. Add `GUSTO_CLIENT_ID` / `GUSTO_CLIENT_SECRET` as secrets
the same way as the Stripe keys above. The client already calls `payrollConnect`
with a graceful fallback, so no front-end change is needed when you deploy it.

Other processors: the payments layer uses Stripe Connect (each agency onboards
its own Stripe account). To offer an alternative processor, add a sibling
callable (e.g. `squareOnboard`) and a provider choice on the "Connect payments"
card — the tenant model already stores the account id per agency.
