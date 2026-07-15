// Care Royal transactional email — Cloudflare Pages Function.
//
// SAME METHOD AS TEGULA: sends branded HTML through the Gmail API using a
// domain-wide-delegated service account that impersonates info@thecareroyal.com
// (no SMTP, no app passwords). Tegula runs this technique in Firebase Functions
// with the `googleapis` + `nodemailer` Node libraries; those don't exist on the
// Cloudflare Workers runtime, so here the JWT is signed with Web Crypto and the
// Gmail REST API is called directly. The credential (GMAIL_SERVICE_ACCOUNT) and
// the delegation are IDENTICAL to Tegula's — reuse the same service-account JSON.
//
// Secret (Cloudflare dashboard -> Pages project -> Settings -> Variables and
// Secrets):  GMAIL_SERVICE_ACCOUNT = the one-line service-account JSON.
//
// Contract:  POST /api/email  { type, ...fields }
//   type "quote"       { agencyName, agencyEmail, q:{name,email,phone,services,frequency,details,recipientName,bestTime} }
//   type "application" { agencyName, agencyEmail, a:{name,email,phone,credentials,experience} }
//   type "booking"     { agencyName, familyEmail, caregiverEmail, svcName, when }
//   type "test"        { to }
//   type "custom"      { to, subject, html, agencyName? }

const MAIL_SUBJECT = "info@thecareroyal.com"; // Workspace user the SA impersonates
const APP_URL = "https://thecareroyal.com";

/* ---------- tiny helpers (Workers runtime: no Buffer, no Node) ---------- */
const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const enc = new TextEncoder();

function bytesToB64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
const b64url = (b64) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const strToB64url = (s) => b64url(bytesToB64(enc.encode(s)));

function encodeSubject(s) {
  return "=?UTF-8?B?" + bytesToB64(enc.encode(String(s || ""))) + "?=";
}

function buildMime({ from, to, subject, html }) {
  const body = bytesToB64(enc.encode(html || "")).replace(/(.{76})/g, "$1\r\n");
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

/* ---------- Gmail auth: sign a service-account JWT, exchange for a token ---------- */
function pemToPkcs8(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    sub: MAIL_SUBJECT, // domain-wide delegation: act as this Workspace user
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${strToB64url(JSON.stringify(header))}.${strToB64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(creds.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
  const assertion = `${signingInput}.${b64url(bytesToB64(new Uint8Array(sig)))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" +
      encodeURIComponent(assertion),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("token: " + (data.error_description || data.error || res.status));
  }
  return data.access_token;
}

async function sendMail(token, { from, to, subject, html }) {
  const raw = b64url(bytesToB64(enc.encode(buildMime({ from, to, subject, html }))));
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    }
  );
  if (!res.ok) throw new Error("send: " + res.status + " " + (await res.text()).slice(0, 200));
}

/* ---------- branded templates (ported verbatim from cloud-functions/index.js) ---------- */
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
const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#4B39EF;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;margin-top:8px">${label}</a>`;
const fromFor = (agency) =>
  `"${String(agency || "Care Royal").replace(/"/g, "")} via Care Royal" <info@thecareroyal.com>`;
const H = (t) => `<h2 style="font-family:Georgia,serif;color:#14181B">${t}</h2>`;
const P = (t) => `<p style="color:#57636C">${t}</p>`;

/* Returns the list of { from, to, subject, html } messages for a request. */
function composeMessages(body) {
  const type = body.type;
  const msgs = [];

  if (type === "quote") {
    const q = body.q || {};
    const ag = body.agencyName || "";
    if (q.email)
      msgs.push({
        from: fromFor(ag),
        to: q.email,
        subject: "We received your care request",
        html: baseEmail(
          ag,
          H(`Thank you, ${esc(q.name) || "there"}`) +
            P(
              `We received your request for care${q.recipientName ? ` for ${esc(q.recipientName)}` : ""}. ${esc(ag) || "The agency"} will review it and reach out${q.bestTime ? ` (${esc(q.bestTime).toLowerCase()})` : ""} to build your care plan and quote.`
            )
        ),
      });
    if (body.agencyEmail)
      msgs.push({
        from: fromFor("Care Royal"),
        to: body.agencyEmail,
        subject: `New quote request from ${q.name || "a client"}`,
        html: baseEmail(
          "Care Royal",
          H("New quote request") +
            P(
              `<b>${esc(q.name)}</b> &middot; ${esc(q.phone)} &middot; ${esc(q.email)}<br>${esc(q.services)}${q.frequency ? " &middot; " + esc(q.frequency) : ""}<br>${esc(q.details)}`
            ) +
            btn(APP_URL + "/agency/", "Open your pipeline")
        ),
      });
    return msgs;
  }

  if (type === "application") {
    const a = body.a || {};
    const ag = body.agencyName || "";
    if (a.email)
      msgs.push({
        from: fromFor(ag),
        to: a.email,
        subject: "We received your application",
        html: baseEmail(
          ag,
          H(`Thanks for applying, ${esc(a.name) || "there"}`) +
            P(`${esc(ag) || "The agency"} received your caregiver application and will review it shortly.`)
        ),
      });
    if (body.agencyEmail)
      msgs.push({
        from: fromFor("Care Royal"),
        to: body.agencyEmail,
        subject: `New caregiver application: ${a.name || ""}`,
        html: baseEmail(
          "Care Royal",
          H("New caregiver application") +
            P(
              `<b>${esc(a.name)}</b> &middot; ${esc(a.phone)} &middot; ${esc(a.email)}<br>${esc(a.credentials)} &middot; ${esc(a.experience)}`
            ) +
            btn(APP_URL + "/agency/", "Review in Recruiting")
        ),
      });
    return msgs;
  }

  if (type === "booking") {
    const ag = body.agencyName || "";
    const svc = esc(body.svcName) || "your care visit";
    const when = esc(body.when) || "the scheduled time";
    if (body.familyEmail)
      msgs.push({
        from: fromFor(ag),
        to: body.familyEmail,
        subject: "Your care visit is confirmed",
        html: baseEmail(
          ag,
          H("Your visit is confirmed") +
            P(`${esc(ag) || "Your agency"} confirmed <b>${svc}</b> for <b>${when}</b>.`) +
            btn(APP_URL + "/family/", "View in your portal")
        ),
      });
    if (body.caregiverEmail)
      msgs.push({
        from: fromFor(ag),
        to: body.caregiverEmail,
        subject: "New shift assigned",
        html: baseEmail(
          ag,
          H("You have a new shift") +
            P(`<b>${svc}</b> &middot; <b>${when}</b>.`) +
            btn(APP_URL + "/caregiver/", "See your schedule")
        ),
      });
    return msgs;
  }

  if (type === "test") {
    if (body.to)
      msgs.push({
        from: fromFor("Care Royal"),
        to: body.to,
        subject: "Care Royal email is working",
        html: baseEmail(
          "Care Royal",
          P("This is a test — your Gmail Workspace delegation is set up correctly.")
        ),
      });
    return msgs;
  }

  if (type === "custom") {
    if (body.to && body.html)
      msgs.push({
        from: body.from || fromFor(body.agencyName || "Care Royal"),
        to: body.to,
        subject: body.subject || "",
        html: body.html,
      });
    return msgs;
  }

  return msgs;
}

/* ---------- Pages Function entrypoint ---------- */
export async function onRequestPost({ request, env }) {
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const raw = env.GMAIL_SERVICE_ACCOUNT;
  if (!raw || raw === "unset") {
    // Email isn't configured yet — succeed silently so the user-facing form
    // flow never breaks. Set the GMAIL_SERVICE_ACCOUNT secret to enable sending.
    return json({ ok: true, sent: 0, note: "email-not-configured" });
  }

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    return json({ error: "GMAIL_SERVICE_ACCOUNT is not valid JSON." }, 500);
  }

  const messages = composeMessages(body);
  if (!messages.length) return json({ ok: true, sent: 0 });

  try {
    const token = await getAccessToken(creds);
    let sent = 0;
    for (const m of messages) {
      try {
        await sendMail(token, m);
        sent++;
      } catch (e) {
        // best-effort per message; keep going
        console.log("email send failed:", e && e.message);
      }
    }
    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 502);
  }
}

// Non-POST methods (POST is routed to onRequestPost above).
export function onRequest() {
  return new Response("Method Not Allowed", { status: 405 });
}
