// Care Royal payments — Stripe Connect on Firebase Cloud Functions.
// This keeps Firebase the ONLY backend. It stays inert (client falls back to
// "payments coming soon") until you deploy it with the two secrets set.
// See PAYMENTS.md for the one-time setup + deploy steps.
const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { google } = require("googleapis");

admin.initializeApp();
const db = admin.firestore();

// This org blocks creation of the default compute service account that Gen-2
// functions would otherwise run as, so pin every function to the existing
// App Engine default SA instead. Without this the deploy fails provisioning the
// missing default SA (exit 2). This SA must hold the roles the runtime needs
// (Secret Manager accessor, Datastore user, etc.).
setGlobalOptions({ serviceAccount: "care-royale2-4dgwu0@care-royale2-4dgwu0.iam.gserviceaccount.com" });

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
// Same Gmail service-account JSON used by Tegula — its domain-wide delegation
// already impersonates info@thecareroyal.com with the gmail.send scope, so no new
// Workspace setup is needed; just set this secret. See PAYMENTS.md / EMAIL section.
const GMAIL_SERVICE_ACCOUNT = defineSecret("GMAIL_SERVICE_ACCOUNT");
const GUSTO_CLIENT_ID = defineSecret("GUSTO_CLIENT_ID");
const GUSTO_CLIENT_SECRET = defineSecret("GUSTO_CLIENT_SECRET");
// Gusto API base. DEMO while using demo keys; switch to https://api.gusto.com
// once the agency is on PRODUCTION (approved partner) keys.
const GUSTO_BASE = "https://api.gusto-demo.com";
// Return-URL base for Stripe onboarding/checkout + Intuit OAuth. The SaaS is served
// under /app on the live domain (landing sits at the root — see WyomingCareapp/
// deploy-with-app.sh, which builds this app with NEXT_PUBLIC_BASE_PATH=/app), so every
// redirect MUST include /app or it lands on the marketing landing page, not the portal.
const APP_URL = "https://thecareroyal.com/app";

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
const GUSTO_REDIRECT = `${APP_URL}/agency/`;
exports.payrollConnect = onCall({ secrets: [GUSTO_CLIENT_ID] }, async (request) => {
  const { tenantId, role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const provider = (request.data && request.data.provider) || "gusto";
  if (provider === "gusto") {
    // Send the agency to Gusto to authorize; state carries the provider so the
    // callback can tell Gusto apart from QuickBooks (which returns a realmId).
    const clientId = GUSTO_CLIENT_ID.value();
    if (!clientId || clientId === "unset") return { error: "Gusto is not configured yet." };
    const url = `${GUSTO_BASE}/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(GUSTO_REDIRECT)}&response_type=code&state=${encodeURIComponent("gusto:" + tenantId)}`;
    return { url };
  }
  // Care Royal in-app payroll — no external account, just switch it on.
  await db.doc(`tenants/${tenantId}`).set({ payrollProvider: provider }, { merge: true });
  return { ok: true, connected: true };
});
// Gusto OAuth callback: trade the code for tokens and store them on the tenant.
exports.gustoExchange = onCall({ secrets: [GUSTO_CLIENT_ID, GUSTO_CLIENT_SECRET] }, async (request) => {
  const { tenantId, role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const code = request.data && request.data.code;
  if (!code) throw new HttpsError("invalid-argument", "Missing code.");
  const r = await fetch(`${GUSTO_BASE}/oauth/token`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: GUSTO_CLIENT_ID.value(), client_secret: GUSTO_CLIENT_SECRET.value(), code, grant_type: "authorization_code", redirect_uri: GUSTO_REDIRECT }),
  });
  const tok = await r.json().catch(() => ({}));
  if (!tok.access_token) return { ok: false, note: tok.error_description || tok.error || "Gusto connection failed." };
  // Tokens to server-only tenantSecrets; only the provider flag on the tenant doc.
  await db.doc(`tenantSecrets/${tenantId}`).set({
    gustoAccessToken: tok.access_token, gustoRefreshToken: tok.refresh_token || "",
  }, { merge: true });
  await db.doc(`tenants/${tenantId}`).set({ payrollProvider: "gusto", gustoConnectedAt: new Date().toISOString() }, { merge: true });
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
  const raw = GMAIL_SERVICE_ACCOUNT.value();
  if (!raw || raw === "unset") return async () => {}; // email not configured yet — no-op
  const creds = JSON.parse(raw);
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

// =====================================================================
// ROADMAP FEATURES — server-side work. Each stays inert until its secret /
// account is configured; the client falls back to heuristics/graceful states.
// =====================================================================
// Item 4 (Assistant) runs entirely in-app via templates (app/lib/templates.ts) —
// no AI key, no Cloud Function.
const CHECKR_API_KEY = defineSecret("CHECKR_API_KEY");       // Item 7 (background checks)
const INTUIT_CLIENT_ID = defineSecret("INTUIT_CLIENT_ID");   // Item 10 (QuickBooks)
const INTUIT_CLIENT_SECRET = defineSecret("INTUIT_CLIENT_SECRET");

// ---- ITEM 2: instant caregiver pay (Stripe instant payout / transfer) ------
// Best-effort earned-wage access. Pays the caregiver's connected Stripe account
// (caregiverProfiles.stripeAccountId) via an instant payout. Stays pending until
// the caregiver has connected a payout destination.
exports.instantPayout = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const { uid, tenantId, role } = await ctx(request);
  const payoutId = request.data && request.data.payoutId;
  const po = await db.doc(`payouts/${payoutId}`).get();
  if (!po.exists || po.data().tenantId !== tenantId) throw new HttpsError("not-found", "Payout not found.");
  const p = po.data();
  // Authorization: only the caregiver who owns this payout, or an agency admin/coordinator,
  // may release it. Without this any tenant member could cash out anyone's payout.
  const isAgency = role === "agency_admin" || role === "agency_coord";
  if (!isAgency && p.caregiverId !== uid) throw new HttpsError("permission-denied", "Not your payout.");
  // Idempotency: never transfer a payout that is already paid (guards double-cash-out).
  if (p.status === "paid") return { ok: true, alreadyPaid: true };
  // Amount is derived from the stored payout — NEVER trusted from the client. A
  // client-supplied amount let a caller drain the Stripe balance with an arbitrary value.
  // Caregiver receives net (gross minus the instant-payout fee recorded on the payout).
  const amount = Math.round((parseFloat(p.net || p.gross) || 0) * 100);
  if (amount <= 0) throw new HttpsError("failed-precondition", "Nothing to pay out.");
  const cgId = p.caregiverId;
  const profSnap = await db.collection("caregiverProfiles").where("userId", "==", cgId).limit(1).get();
  const acct = profSnap.empty ? "" : profSnap.docs[0].data().stripeAccountId;
  if (!acct) return { ok: false, pending: true, note: "Caregiver has not connected a payout destination yet." };
  try {
    const transfer = await stripe().transfers.create({ amount, currency: "usd", destination: acct, metadata: { payoutId, tenantId } });
    await stripe().payouts.create({ amount, currency: "usd", method: "instant" }, { stripeAccount: acct }).catch(() => {});
    await db.doc(`payouts/${payoutId}`).set({ status: "paid", stripeId: transfer.id }, { merge: true });
    return { ok: true };
  } catch (e) {
    await db.doc(`payouts/${payoutId}`).set({ status: "pending" }, { merge: true });
    return { ok: false, pending: true, note: e.message };
  }
});

// ---- ITEM 3: Telephony EVV / IVR clock-in (Twilio webhook) -----------------
// Caregiver calls the Twilio number, enters their PIN then the 4-digit shift
// code; we clock in (or out if already clocked in). Returns TwiML (XML).
function twiml(inner) { return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`; }
function gather(prompt, numDigits) { return `<Gather input="dtmf" numDigits="${numDigits}" action="/ivrWebhook" method="POST"><Say>${prompt}</Say></Gather><Say>We didn't get that. Goodbye.</Say>`; }
exports.ivrWebhook = onRequest(async (req, res) => {
  res.set("Content-Type", "text/xml");
  const digits = (req.body && req.body.Digits) || "";
  const pin = (req.body && req.body.pin) || "";
  try {
    // Step 1: no digits yet → ask for PIN.
    if (!digits && !pin) { res.send(twiml(gather("Welcome to Care Royal. Enter your caregiver P I N, then press pound.", ""))); return; }
    // Step 2: got the PIN → look up the caregiver, ask for the shift code.
    if (digits && !pin) {
      const prof = await db.collection("caregiverProfiles").where("pin", "==", digits).limit(1).get();
      if (prof.empty) { res.send(twiml(`<Say>That P I N was not recognized. Goodbye.</Say>`)); return; }
      const uid = prof.docs[0].data().userId;
      res.send(twiml(`<Gather input="dtmf" numDigits="4" action="/ivrWebhook?pin=${encodeURIComponent(uid)}" method="POST"><Say>Enter your four digit shift code.</Say></Gather><Say>Goodbye.</Say>`));
      return;
    }
    // Step 3: pin (carrying the caregiver uid) + shift code → clock in/out.
    const uid = pin; const code = digits;
    const shifts = await db.collection("shifts").where("caregiverId", "==", uid).where("shiftCode", "==", code).limit(1).get();
    if (shifts.empty) { res.send(twiml(`<Say>No matching shift found. Goodbye.</Say>`)); return; }
    const ref = shifts.docs[0].ref; const s = shifts.docs[0].data(); const nowIso = new Date().toISOString();
    if (!s.clockIn) { await ref.set({ clockIn: nowIso, status: "in_progress", gpsIn: "phone" }, { merge: true }); res.send(twiml(`<Say>You are clocked in. Have a great visit. Goodbye.</Say>`)); return; }
    await ref.set({ clockOut: nowIso, status: "completed", gpsOut: "phone" }, { merge: true });
    if (s.bookingId) await db.doc(`bookings/${s.bookingId}`).set({ status: "completed" }, { merge: true }).catch(() => {});
    res.send(twiml(`<Say>You are clocked out. Thank you. Goodbye.</Say>`));
  } catch (e) {
    res.send(twiml(`<Say>Sorry, an error occurred. Goodbye.</Say>`));
  }
});

// ---- ITEM 7: Checkr background checks --------------------------------------
async function checkrGET(path, key) {
  const r = await fetch(`https://api.checkr.com/v1${path}`, { headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64") } });
  return r.json();
}
async function checkrPOST(path, key, body) {
  const r = await fetch(`https://api.checkr.com/v1${path}`, { method: "POST", headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64"), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
exports.checkrInvite = onCall({ secrets: [CHECKR_API_KEY] }, async (request) => {
  const { tenantId, role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const key = CHECKR_API_KEY.value();
  if (!key || key === "unset") return { status: "pending", note: "Checkr not configured." };
  const targetUid = request.data && request.data.userId;
  const u = await db.doc(`users/${targetUid}`).get();
  if (!u.exists) throw new HttpsError("not-found", "Caregiver not found.");
  const [first, ...rest] = String(u.data().name || "Caregiver").split(" ");
  const candidate = await checkrPOST("/candidates", key, { first_name: first, last_name: rest.join(" ") || first, email: u.data().email });
  const invitation = await checkrPOST("/invitations", key, { candidate_id: candidate.id, package: "driver_pro" });
  return { id: candidate.id, status: invitation.status || "pending", invitationUrl: invitation.invitation_url || "" };
});
exports.checkrStatus = onCall({ secrets: [CHECKR_API_KEY] }, async (request) => {
  const { role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const key = CHECKR_API_KEY.value(); if (!key || key === "unset") return { status: "pending" };
  const targetUid = request.data && request.data.userId;
  const prof = await db.collection("caregiverProfiles").where("userId", "==", targetUid).limit(1).get();
  const candidateId = prof.empty ? "" : prof.docs[0].data().bgCheckId;
  if (!candidateId) return { status: "pending" };
  const reports = await checkrGET(`/candidates/${candidateId}/reports`, key);
  const report = (reports.data || [])[0];
  return { status: report ? report.status : "pending", result: report ? report.result : "" };
});

// ---- ITEM 10: QuickBooks Online sync + audit packs -------------------------
const INTUIT_REDIRECT = `${APP_URL}/agency/`;
// Company API base. SANDBOX while using Development keys; switch to
// https://quickbooks.api.intuit.com when the agency is on PRODUCTION keys.
const QBO_API_BASE = "https://sandbox-quickbooks.api.intuit.com";
// Exchange an authorization code or refresh token for Intuit OAuth tokens.
async function intuitToken(form) {
  const basic = Buffer.from(`${INTUIT_CLIENT_ID.value()}:${INTUIT_CLIENT_SECRET.value()}`).toString("base64");
  const r = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form).toString(),
  });
  return r.json().catch(() => ({}));
}
exports.quickbooksStatus = onCall(async (request) => {
  const { tenantId } = await ctx(request);
  const t = await db.doc(`tenants/${tenantId}`).get();
  return { connected: !!(t.exists && t.data().qboConnected) };
});
// OAuth callback: the agency page posts the code + realmId Intuit returned; we
// trade them for tokens and store them on the tenant. Needs the client secret.
exports.quickbooksExchange = onCall({ secrets: [INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET] }, async (request) => {
  const { tenantId, role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const code = request.data && request.data.code;
  const realmId = request.data && request.data.realmId;
  if (!code || !realmId) throw new HttpsError("invalid-argument", "Missing code or realmId.");
  const tok = await intuitToken({ grant_type: "authorization_code", code, redirect_uri: INTUIT_REDIRECT });
  if (!tok.access_token) return { ok: false, note: tok.error_description || tok.error || "Token exchange failed." };
  // Tokens live in tenantSecrets (server-only, never client-readable); only a safe
  // "connected" flag goes on the client-readable tenant doc.
  await db.doc(`tenantSecrets/${tenantId}`).set({
    qboRealmId: String(realmId), qboAccessToken: tok.access_token, qboRefreshToken: tok.refresh_token || "",
  }, { merge: true });
  await db.doc(`tenants/${tenantId}`).set({ qboConnected: true, qboConnectedAt: new Date().toISOString() }, { merge: true });
  return { ok: true, connected: true };
});
exports.quickbooksConnect = onCall({ secrets: [INTUIT_CLIENT_ID] }, async (request) => {
  const { tenantId, role } = await ctx(request);
  if (role !== "agency_admin" && role !== "agency_coord") throw new HttpsError("permission-denied", "Agency only.");
  const clientId = INTUIT_CLIENT_ID.value();
  if (!clientId || clientId === "unset") return { error: "QuickBooks is not configured yet." };
  const state = tenantId;
  const url = `https://appcenter.intuit.com/connect/oauth2?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${encodeURIComponent(INTUIT_REDIRECT)}&state=${encodeURIComponent(state)}`;
  return { url };
});
exports.quickbooksSync = onCall({ secrets: [INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET] }, async (request) => {
  const { tenantId } = await ctx(request);
  const sref = db.doc(`tenantSecrets/${tenantId}`);
  const s = await sref.get();
  const realmId = s.exists ? s.data().qboRealmId : "";
  const refreshToken = s.exists ? s.data().qboRefreshToken : "";
  if (!realmId || !refreshToken) return { ok: false, note: "Connect QuickBooks first." };
  // Intuit access tokens expire hourly — refresh before every sync, then persist
  // the rotated refresh token (server-only tenantSecrets).
  const tok = await intuitToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  const token = tok.access_token;
  if (!token) return { ok: false, note: "QuickBooks session expired — reconnect." };
  await sref.set({ qboAccessToken: token, ...(tok.refresh_token ? { qboRefreshToken: tok.refresh_token } : {}) }, { merge: true });
  const invSnap = await db.collection("invoices").where("tenantId", "==", tenantId).where("status", "==", "unpaid").get();
  // Push each unpaid invoice as a QuickBooks Invoice (best-effort; skips on error).
  let synced = 0;
  for (const doc of invSnap.docs) {
    const inv = doc.data();
    const r = await fetch(`${QBO_API_BASE}/v3/company/${realmId}/invoice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ Line: [{ Amount: parseFloat(inv.amount) || 0, DetailType: "SalesItemLineDetail", SalesItemLineDetail: { ItemRef: { value: "1" } } }], CustomerRef: { value: "1" } }),
    }).catch(() => null);
    if (r && r.ok) { synced++; await doc.ref.set({ qboSynced: true }, { merge: true }); }
  }
  return { ok: true, synced };
});

// ---- ITEM 9: anonymized benchmarking (scheduled, cross-tenant, no PII) ------
exports.benchmarkAggregate = onSchedule("every 24 hours", async () => {
  const [tenants, shifts, profiles, invoices] = await Promise.all([
    db.collection("tenants").get(), db.collection("shifts").get(),
    db.collection("caregiverProfiles").get(), db.collection("invoices").get(),
  ]);
  const byTenant = {};
  const bucket = (id) => (byTenant[id] ||= { assignable: 0, filled: 0, rates: [], collected: 0, caregivers: 0 });
  shifts.forEach((d) => { const s = d.data(); const b = bucket(s.tenantId); if (s.status !== "cancelled") b.assignable++; if (s.status !== "open" && s.status !== "cancelled") b.filled++; });
  profiles.forEach((d) => { const p = d.data(); const b = bucket(p.tenantId); b.caregivers++; const r = parseFloat(p.rate || "0"); if (r > 0) b.rates.push(r); });
  invoices.forEach((d) => { const i = d.data(); if (i.status === "paid") bucket(i.tenantId).collected += parseFloat(i.amount) || 0; });
  const fills = [], wages = [], cgs = [];
  Object.values(byTenant).forEach((b) => {
    if (b.assignable) fills.push((b.filled / b.assignable) * 100);
    if (b.rates.length) wages.push(b.rates.reduce((a, c) => a + c, 0) / b.rates.length);
    cgs.push(b.caregivers);
  });
  const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) / 100 : 0);
  await db.doc("benchmarks/global").set({
    fillRate: Math.round(avg(fills)), avgWage: avg(wages), caregivers: Math.round(avg(cgs)),
    sample: tenants.size, updatedAt: new Date().toISOString(),
  }, { merge: true });
});
