// Best-effort email notifications via Gmail API (service-account domain
// delegation), configured by env. If NOTIFY_FROM_EMAIL is unset, it no-ops so
// nothing ever breaks the primary action.
import { getAccessToken } from "./googleAuth.js";
import { getCreds } from "./creds.js";

const SCOPE = "https://www.googleapis.com/auth/gmail.send";

function b64url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function shell(title, body) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f7faf8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;max-width:560px;border:1px solid #dfe7e3">
  <tr><td style="background:#0f5647;padding:22px 28px">
    <div style="font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:600">Care Royal</div>
  </td></tr>
  <tr><td style="padding:28px">
    <h2 style="color:#0f1a17;font-family:Georgia,serif;font-size:20px;margin:0 0 12px">${title}</h2>
    <div style="color:#4b5f59;font-size:14px;line-height:1.6">${body}</div>
  </td></tr>
  <tr><td style="background:#e8f2ef;padding:16px 28px;font-size:11px;color:#8aa39b">Care Royal — care agency platform</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendEmail(env, to, subject, html) {
  const from = env.NOTIFY_FROM_EMAIL;
  if (!from) return; // not configured — silently skip
  const name = env.NOTIFY_FROM_NAME || "Care Royal";
  const creds = getCreds(env);
  const token = await getAccessToken(creds.client_email, creds.private_key, SCOPE, from);
  const msg = [
    `From: ${name} <${from}>`, `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64", "", btoa(unescape(encodeURIComponent(html))),
  ].join("\r\n");
  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(msg) }),
  });
}

// Never throws — notifications must not break the main request.
export async function notify(env, to, title, bodyHtml) {
  try {
    if (!to) return;
    await sendEmail(env, to, title, shell(title, bodyHtml));
  } catch (_) { /* swallow */ }
}
