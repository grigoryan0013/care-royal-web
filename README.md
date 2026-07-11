# Care Royal — web platform

Multi-tenant care agency platform: family bookings, caregiver scheduling with
clock in/out, payments (Stripe Connect), payroll, e-sign documents, and a lead
pipeline. Next.js (static export) + Cloudflare Pages Functions + Google
Sheets/Docs/Drive data layer.

## Demo / review
The GitHub Pages build runs in **demo mode** on seeded sample data (no backend
or credentials). Open the site, click **Sign in**, and log in with:

- **Username:** `grigoryan`
- **Password:** `201816`

You land on a hub to enter the **Agency**, **Family**, and **Caregiver** portals,
and a bar at the top lets you switch between them from the one login. All actions
persist in your browser; use **Reset demo data** to start over.

The public landing page shows the pre-launch waitlist with the Direct Staffing and
VIP Agency questionnaires.

## Local development
```bash
npm install
npm run dev
```

## Production (Cloudflare Pages + Google/Stripe)
See `SETUP.md`, `PLAN.md`, and `DATAMODEL.md`. Set the environment variables in
the Cloudflare Pages dashboard and run the one-time bootstrap. Production does
NOT set `NEXT_PUBLIC_DEMO`, so it uses the real API/data layer.
