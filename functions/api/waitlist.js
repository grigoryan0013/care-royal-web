// Public pre-launch waitlist + questionnaire capture. No auth. Appends to the
// Waitlist tab. Kept intentionally permissive on fields (stored as details JSON)
// but capped for abuse safety. Requires explicit consent.
import { json } from "../lib/creds.js";
import { insert, genId, ensureAllTabs } from "../lib/tenant.js";

const cap = (s, n = 400) => String(s ?? "").slice(0, n);

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  const type = body.type === "agency" ? "agency" : "direct";
  const email = cap(body.email, 160).trim();
  const name = cap(body.name, 160).trim();
  if (!email || !email.includes("@")) return json({ error: "A valid email is required." }, 400);
  if (!body.consent) return json({ error: "Please agree to be contacted and to the Privacy Notice." }, 400);

  // Everything else is stored as a details blob so the questionnaire can evolve.
  const details = {};
  for (const [k, v] of Object.entries(body.details || {})) details[cap(k, 60)] = cap(v, 600);

  try {
    await ensureAllTabs(env); // makes the Waitlist tab on first submit if missing
    await insert(env, "Waitlist", {
      waitlistId: genId("wl"), type, name, email,
      phone: cap(body.phone, 40), region: cap(body.region, 120),
      timeframe: cap(body.timeframe, 80), details: JSON.stringify(details),
      consent: "yes", createdAt: new Date().toISOString(),
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
