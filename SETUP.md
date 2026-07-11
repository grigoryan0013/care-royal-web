# Care Royal — Setup & Deploy (Cloudflare Pages + Google Sheets)

Architecture: Next.js (static export) + Cloudflare Pages Functions API +
Google Sheets/Docs/Drive as the private data layer (service account in *your*
Google Workspace). Same pattern as PGL.

## What I need from you to make it live
1. **Google service account JSON** — a service account with the Google Sheets API
   (and later Drive/Docs) enabled. The whole JSON, as one string.
   - Reuse an existing one from PGL/Tegula, or create a fresh one for Care Royal.
2. **A Google Sheet** shared with that service account's email (Editor). Copy its
   ID from the URL — that's `MASTER_SHEET_ID`. It can be empty; the app builds the tabs.
3. **A random `ADMIN_JWT_SECRET`** (any long random string) — signs sessions.
4. **A `BOOTSTRAP_SECRET`** (any random string) — protects the one-time bootstrap.
5. **Stripe** (Category 4 — payments/payroll):
   - `STRIPE_SECRET_KEY` (sk_live_/sk_test_), with **Connect enabled** on the account.
   - `STRIPE_WEBHOOK_SECRET` (whsec_) — add a webhook to `/api/stripe-webhook`
     for `checkout.session.completed` and `payment_intent.succeeded`.
   - `PAYROLL_PROVIDER` (optional) — set once an embedded payroll backbone
     (Check / Gusto Embedded) is wired, to enable actual pay runs.
6. **Email notifications** (optional): `NOTIFY_FROM_EMAIL` + `NOTIFY_FROM_NAME`.
   Requires the service account to have Gmail domain-wide delegation for that
   sender (same setup as Tegula/PGL). If unset, notifications silently no-op.

## Security note (static export)
This app deploys as static files (`output: "export"`) with no Next.js server.
The open Next.js CVEs all target the server runtime (Image Optimization, RSC
cache, middleware, WebSocket upgrades) and are not reachable in this
architecture. A move to Next 16 is optional/future, not required.

## Local run
```bash
cd ~/Desktop/CareRoyal
npm install
npm run build      # static export to ./out
```
For local API testing use `npx wrangler pages dev out` with a `.dev.vars` file
holding the secrets below.

## Cloudflare Pages env vars (Settings -> Environment variables, encrypted)
```
GOOGLE_SERVICE_ACCOUNT = { ...full service account JSON... }
MASTER_SHEET_ID        = <sheet id from the URL>
ADMIN_JWT_SECRET       = <random string>
BOOTSTRAP_SECRET       = <random string>
```

## First-time bootstrap (creates tabs + Tenant #1 + admin)
After deploy, run once:
```bash
curl -X POST https://<your-pages-domain>/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "action":"bootstrap",
    "secret":"<BOOTSTRAP_SECRET>",
    "tenantName":"Care Royal",
    "slug":"care-royal",
    "adminEmail":"you@example.com",
    "adminPassword":"<choose a strong password>",
    "adminName":"Owner"
  }'
```
Then sign in at `/login/` with that admin email. Families and caregivers can
self-register (they attach to the `care-royal` tenant slug).

## Verify wiring
`GET /api/diag` returns which secrets are present (never the values).

## Deploy note
Deploy via the Cloudflare Pages Git integration or `wrangler pages deploy out`.
Never commit the service account JSON or any secret — they live only in the
Pages dashboard.
