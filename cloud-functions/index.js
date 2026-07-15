// Care Royal payments — Stripe Connect on Firebase Cloud Functions.
// This keeps Firebase the ONLY backend. It stays inert (client falls back to
// "payments coming soon") until you deploy it with the two secrets set.
// See PAYMENTS.md for the one-time setup + deploy steps.
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const APP_URL = "https://thecareroyal.com"; // return URL base for onboarding/checkout

function stripe() { return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: "2024-06-20" }); }

async function ctx(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const u = await db.doc(`users/${uid}`).get();
  const tenantId = u.exists ? u.data().tenantId : "";
  if (!tenantId) throw new HttpsError("failed-precondition", "No tenant.");
  return { uid, tenantId, role: u.data().role };
}

// Is the agency's Stripe account connected + able to accept charges?
exports.connectStatus = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { tenantId } = await ctx(request);
  const t = await db.doc(`tenants/${tenantId}`).get();
  const acct = t.exists ? t.data().stripeAccountId : "";
  if (!acct) return { connected: false };
  const a = await stripe().accounts.retrieve(acct);
  return { connected: true, chargesEnabled: !!a.charges_enabled };
});

// Create (or resume) Stripe Connect onboarding for the agency.
exports.connectOnboard = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { tenantId, role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const ref = db.doc(`tenants/${tenantId}`);
  const t = await ref.get();
  let acct = t.exists ? t.data().stripeAccountId : "";
  if (!acct) {
    const a = await stripe().accounts.create({ type: "express", metadata: { tenantId } });
    acct = a.id;
    await ref.set({ stripeAccountId: acct }, { merge: true });
  }
  const link = await stripe().accountLinks.create({
    account: acct,
    refresh_url: `${APP_URL}/agency/`,
    return_url: `${APP_URL}/agency/`,
    type: "account_onboarding",
  });
  return { url: link.url };
});

// Create a Checkout Session for a specific invoice (family pays; agency is paid).
exports.createCheckout = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { tenantId } = await ctx(request);
  const invoiceId = request.data && request.data.invoiceId;
  const inv = await db.doc(`invoices/${invoiceId}`).get();
  if (!inv.exists || inv.data().tenantId !== tenantId) throw new HttpsError("not-found", "Invoice not found.");
  const t = await db.doc(`tenants/${tenantId}`).get();
  const acct = t.exists ? t.data().stripeAccountId : "";
  if (!acct) throw new HttpsError("failed-precondition", "Agency has not connected payments.");
  const amount = Math.round((parseFloat(inv.data().amount) || 0) * 100);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", product_data: { name: "Care Royal services" }, unit_amount: amount }, quantity: 1 }],
    payment_intent_data: { application_fee_amount: Math.round(amount * 0.02), transfer_data: { destination: acct } },
    success_url: `${APP_URL}/family/?paid=1`,
    cancel_url: `${APP_URL}/family/`,
    metadata: { invoiceId, tenantId },
  });
  return { url: session.url };
});

// Record that the agency is connecting its OWN payroll provider (Gusto).
// Full Gusto OAuth returns an authorize URL here once the Gusto app credentials
// (GUSTO_CLIENT_ID/SECRET) are wired — see PAYMENTS.md. Until then it just marks
// the tenant connected so gross pay can be synced.
exports.payrollConnect = onCall(async (request) => {
  const { tenantId, role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const provider = (request.data && request.data.provider) || "gusto";
  await db.doc(`tenants/${tenantId}`).set({ payrollProvider: provider }, { merge: true });
  return { ok: true, connected: true };
});

// Stripe webhook — mark the invoice paid on successful checkout.
exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  let event;
  try {
    event = stripe().webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET.value());
  } catch (e) {
    res.status(400).send(`Webhook Error: ${e.message}`);
    return;
  }
  if (event.type === "checkout.session.completed") {
    const invoiceId = event.data.object.metadata && event.data.object.metadata.invoiceId;
    if (invoiceId) await db.doc(`invoices/${invoiceId}`).set({ status: "paid", stripeId: event.data.object.payment_intent || "" }, { merge: true });
  }
  res.json({ received: true });
});
