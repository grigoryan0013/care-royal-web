# Care Royal — Setup & Deploy (Next.js static + Firebase)

**Architecture:** Next.js (static export) + **Firebase (Auth + Firestore) as the
only backend**. All data access is client-side (`app/lib/fb.ts`) and secured by
`firestore.rules`. There are no server functions and no server-side secrets.
Cloudflare Pages (or any static host) just serves the `out/` bundle.

> Note: the old Google Sheets / Cloudflare Pages Functions backend has been
> retired. The Firebase web config in `app/lib/firebase.ts` is public by design
> (project `care-royale2-4dgwu0`); security lives in the Firestore rules.

## Local run
```bash
cd ~/Desktop/CareRoyal
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to ./out
```

## Modes
- **Demo mode** — sign in with `grigoryan` / `201816`. Runs the entire app on
  seeded localStorage data, no Firebase needed. One identity switches between the
  Agency, Family and Caregiver portals.
- **Real mode** — real accounts via Firebase Auth. Sign up at `/login/?mode=signup`:
  - **Agency** → creates a new tenant, mints a 6-char join code, loads the full
    service catalog, and signs you in as `agency_admin`.
  - **Family / Caregiver** → enter the agency's join code to attach to that tenant.

## Go-live checklist (real mode)
1. **Firebase Auth** — enable Email/Password sign-in in the Firebase console.
2. **Firestore** — create the database (production mode).
3. **Deploy the security rules** (required — signup writes tenant/user docs):
   ```bash
   firebase deploy --only firestore:rules
   ```
4. **Deploy the static site** to Cloudflare Pages via the Git integration
   (build: `npm run build`, output dir: `out`).
5. Create the first agency by signing up as **Agency** at `/login/?mode=signup`,
   then share that agency's join code with staff and families.

## Payments & payroll (future)
Stripe Connect and payroll payouts require a small server surface for the secret
key. When wired, add it as a **Firebase Cloud Function** (keeping Firebase as the
single backend) — see `app/lib/fb.ts` `/api/connect`, which is currently a stub.
Invoices, timesheets and gross-pay calculations already work client-side today.
