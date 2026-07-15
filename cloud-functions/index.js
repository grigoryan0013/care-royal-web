// Care Royal payments — Stripe Connect on Firebase Cloud Functions.
// This keeps Firebase the ONLY backend. It stays inert (client falls back to
// "payments coming soon") until you deploy it with the two secrets set.
// See PAYMENTS.md for the one-time setup + deploy steps.
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { google } = require("googleapis");

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
// Same Gmail service-account JSON used by Tegula — its domain-wide delegation
// already impersonates info@thecareroyal.com with the gmail.send scope, so no new
// Workspace setup is needed; just set this secret. See PAYMENTS.md / EMAIL section.
const GMAIL_SERVICE_ACCOUNT = defineSecret("GMAIL_SERVICE_ACCOUNT");
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

// =====================================================================
// EMAIL — Gmail API via domain-wide-delegated service account (Tegula pattern)
// =====================================================================
const MAIL_SUBJECT = "info@thecareroyal.com"; // Workspace user the SA impersonates
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function encodeSubject(s) { return "=?UTF-8?B?" + Buffer.from(String(s), "utf8").toString("base64") + "?="; }
function buildMime({ from, to, subject, html }) {
  return [
    `From: ${from}`, `To: ${to}`, `Subject: ${encodeSubject(subject || "")}`,
    "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "",
    Buffer.from(html || "", "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}
function transporter() {
  const creds = JSON.parse(GMAIL_SERVICE_ACCOUNT.value());
  const auth = new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes: ["https://www.googleapis.com/auth/gmail.send"], subject: MAIL_SUBJECT });
  const gmail = google.gmail({ version: "v1", auth });
  return async ({ from, to, subject, html }) => {
    const raw = Buffer.from(buildMime({ from, to, subject, html })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  };
}
// Branded template wrapper. `agency` sets the display name + footer.
function baseEmail(agency, bodyHtml) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f1f4f8;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#0D0459,#4B39EF);padding:22px 28px">
      <div style="color:#fff;font-size:20px;font-weight:700;font-family:Georgia,serif">${esc(agency || "Care Royal")}</div>
      <div style="color:rgba(255,255,255,.65);font-size:11px;letter-spacing:.12em;text-transform:uppercase">Powered by Care Royal</div>
    </div>
    <div style="padding:28px">${bodyHtml}</div>
    <div style="padding:16px 28px;color:#8b95a1;font-size:11px;border-top:1px solid #E0E3E7">This message was sent by ${esc(agency || "Care Royal")} via Care Royal. Please do not reply to this address.</div>
  </div>`;
}
const btn = (href, label) => `<a href="${href}" style="display:inline-block;background:#4B39EF;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;margin-top:8px">${label}</a>`;
const fromFor = (agency) => `"${(agency || "Care Royal").replace(/"/g, "")} via Care Royal" <info@thecareroyal.com>`;

async function agencyContact(tenantId) {
  try {
    const t = await db.doc(`tenants/${tenantId}`).get();
    const name = t.exists ? t.data().name : "";
    const ownerUid = t.exists ? t.data().ownerUid : "";
    let email = "";
    if (ownerUid) { const u = await db.doc(`users/${ownerUid}`).get(); email = u.exists ? u.data().email : ""; }
    return { name, email };
  } catch { return { name: "", email: "" }; }
}

// New quote request → acknowledge the client + notify the agency.
exports.onQuoteRequest = onDocumentCreated({ document: "quoteRequests/{id}", secrets: [GMAIL_SERVICE_ACCOUNT] }, async (event) => {
  const q = event.data.data(); if (!q) return;
  const send = transporter();
  const ag = await agencyContact(q.tenantId);
  if (q.email) await send({ from: fromFor(ag.name), to: q.email, subject: "We received your care request", html: baseEmail(ag.name, `<h2 style="font-family:Georgia,serif;color:#14181B">Thank you, ${esc(q.name) || "there"}</h2><p style="color:#57636C">We received your request for care${q.recipientName ? ` for ${esc(q.recipientName)}` : ""}. ${esc(ag.name) || "The agency"} will review it and reach out${q.bestTime ? ` (${esc(q.bestTime).toLowerCase()})` : ""} to build your care plan and quote.</p>`) }).catch(() => {});
  if (ag.email) await send({ from: fromFor("Care Royal"), to: ag.email, subject: `New quote request from ${q.name || "a client"}`, html: baseEmail("Care Royal", `<h2 style="font-family:Georgia,serif;color:#14181B">New quote request</h2><p style="color:#57636C"><b>${esc(q.name)}</b> · ${esc(q.phone)} · ${esc(q.email)}<br>${esc(q.services)}${q.frequency ? " · " + esc(q.frequency) : ""}<br>${esc(q.details)}</p>${btn(APP_URL + "/agency/", "Open your pipeline")}`) }).catch(() => {});
});

// New caregiver application → acknowledge applicant + notify agency.
exports.onCaregiverApplication = onDocumentCreated({ document: "caregiverApplications/{id}", secrets: [GMAIL_SERVICE_ACCOUNT] }, async (event) => {
  const a = event.data.data(); if (!a) return;
  const send = transporter();
  const ag = await agencyContact(a.tenantId);
  if (a.email) await send({ from: fromFor(ag.name), to: a.email, subject: "We received your application", html: baseEmail(ag.name, `<h2 style="font-family:Georgia,serif;color:#14181B">Thanks for applying, ${esc(a.name) || "there"}</h2><p style="color:#57636C">${esc(ag.name) || "The agency"} received your caregiver application and will review it shortly.</p>`) }).catch(() => {});
  if (ag.email) await send({ from: fromFor("Care Royal"), to: ag.email, subject: `New caregiver application: ${a.name || ""}`, html: baseEmail("Care Royal", `<h2 style="font-family:Georgia,serif;color:#14181B">New caregiver application</h2><p style="color:#57636C"><b>${esc(a.name)}</b> · ${esc(a.phone)} · ${esc(a.email)}<br>${esc(a.credentials)} · ${esc(a.experience)}</p>${btn(APP_URL + "/agency/", "Review in Recruiting")}`) }).catch(() => {});
});

// Booking confirmed (status → scheduled) → notify the family + assigned caregiver.
exports.onBookingScheduled = onDocumentUpdated({ document: "bookings/{id}", secrets: [GMAIL_SERVICE_ACCOUNT] }, async (event) => {
  const before = event.data.before.data(); const after = event.data.after.data();
  if (!after || before.status === after.status || after.status !== "scheduled") return;
  const send = transporter();
  const ag = await agencyContact(after.tenantId);
  const svc = after.serviceId ? await db.doc(`services/${after.serviceId}`).get().catch(() => null) : null;
  const svcName = svc && svc.exists ? svc.data().name : "your care visit";
  const when = after.start ? new Date(after.start).toLocaleString() : "the scheduled time";
  // family
  try {
    const hh = after.householdId ? await db.doc(`households/${after.householdId}`).get() : null;
    const fUid = hh && hh.exists ? hh.data().primaryUserId : "";
    if (fUid) { const fu = await db.doc(`users/${fUid}`).get(); const fe = fu.exists ? fu.data().email : ""; if (fe) await send({ from: fromFor(ag.name), to: fe, subject: "Your care visit is confirmed", html: baseEmail(ag.name, `<h2 style="font-family:Georgia,serif;color:#14181B">Your visit is confirmed</h2><p style="color:#57636C">${esc(ag.name) || "Your agency"} confirmed <b>${esc(svcName)}</b> for <b>${esc(when)}</b>.</p>${btn(APP_URL + "/family/", "View in your portal")}`) }); }
  } catch { /* */ }
  // caregiver
  try {
    if (after.caregiverId) { const cu = await db.doc(`users/${after.caregiverId}`).get(); const ce = cu.exists ? cu.data().email : ""; if (ce) await send({ from: fromFor(ag.name), to: ce, subject: "New shift assigned", html: baseEmail(ag.name, `<h2 style="font-family:Georgia,serif;color:#14181B">You have a new shift</h2><p style="color:#57636C"><b>${esc(svcName)}</b> · <b>${esc(when)}</b>.</p>${btn(APP_URL + "/caregiver/", "See your schedule")}`) }); }
  } catch { /* */ }
});

// Owner test: send a sample email to confirm Workspace delegation works.
exports.emailTest = onCall({ secrets: [GMAIL_SERVICE_ACCOUNT] }, async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const u = await db.doc(`users/${uid}`).get();
  const to = (u.exists && u.data().email) || MAIL_SUBJECT;
  await transporter()({ from: fromFor("Care Royal"), to, subject: "Care Royal email is working", html: baseEmail("Care Royal", `<p style="color:#57636C">This is a test — your Gmail Workspace delegation is set up correctly.</p>`) });
  return { ok: true, to };
});
