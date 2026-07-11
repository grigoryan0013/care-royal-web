// Invoices: generate from completed shifts, list, pay (Stripe Connect), mark paid.
import { json } from "../lib/creds.js";
import { getSession, requireRole, AGENCY } from "../lib/authctx.js";
import { readTenant, insert, updateWhere, genId, getTenantById } from "../lib/tenant.js";
import { invoiceAmount } from "../lib/billing.js";
import { stripeCall } from "../lib/stripe.js";

function enrich(invoices, bookings, services, recipients, households) {
  const bk = Object.fromEntries(bookings.map((b) => [b.bookingId, b]));
  const svc = Object.fromEntries(services.map((s) => [s.serviceId, s]));
  const rcp = Object.fromEntries(recipients.map((r) => [r.recipientId, r]));
  const hh = Object.fromEntries(households.map((h) => [h.householdId, h]));
  return invoices.map((inv) => {
    const b = bk[inv.bookingId] || {};
    return {
      ...inv,
      serviceName: svc[b.serviceId]?.name || "",
      recipientName: rcp[b.recipientId]?.name || "",
      householdName: hh[inv.householdId]?.name || "",
    };
  });
}

export async function onRequestGet({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  try {
    const t = claims.tenantId;
    const [invoices, bookings, services, recipients, households] = await Promise.all([
      readTenant(env, "Invoices", t), readTenant(env, "Bookings", t),
      readTenant(env, "Services", t), readTenant(env, "Recipients", t),
      readTenant(env, "Households", t),
    ]);
    let mine = invoices;
    if (claims.role === "family") {
      const hh = households.filter((h) => h.primaryUserId === claims.userId).map((h) => h.householdId);
      mine = invoices.filter((i) => hh.includes(i.householdId));
    }
    return json({ invoices: enrich(mine, bookings, services, recipients, households).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  try {
    // Family pays an invoice via Stripe Checkout on the agency's connected account.
    if (body.action === "pay") {
      if (claims.role !== "family") return json({ error: "family only" }, 403);
      const t = claims.tenantId;
      const [invoices, households] = await Promise.all([readTenant(env, "Invoices", t), readTenant(env, "Households", t)]);
      const inv = invoices.find((i) => i.invoiceId === body.invoiceId);
      if (!inv) return json({ error: "invoice not found" }, 404);
      const ownsIt = households.some((h) => h.householdId === inv.householdId && h.primaryUserId === claims.userId);
      if (!ownsIt) return json({ error: "forbidden" }, 403);
      if (inv.status === "paid") return json({ error: "already paid" }, 409);
      const tenant = await getTenantById(env, t);
      if (!tenant?.stripeAccountId) return json({ error: "agency has not connected payments yet" }, 400);
      const origin = new URL(request.url).origin;
      const session = await stripeCall(env, "checkout/sessions", {
        mode: "payment",
        success_url: `${origin}/family/?paid=1`,
        cancel_url: `${origin}/family/`,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(parseFloat(inv.amount || "0") * 100),
            product_data: { name: `Care Royal — invoice ${inv.invoiceId}` },
          },
        }],
        metadata: { invoiceId: inv.invoiceId, tenantId: t },
        payment_intent_data: { metadata: { invoiceId: inv.invoiceId, tenantId: t } },
      }, { account: tenant.stripeAccountId });
      return json({ ok: true, url: session.url });
    }

    // Agency actions
    const guard = await requireRole(request, env, AGENCY);
    if (guard.error) return guard.error;
    const t = claims.tenantId;

    if (body.action === "generate") {
      const [shifts, bookings, services, invoices] = await Promise.all([
        readTenant(env, "Shifts", t), readTenant(env, "Bookings", t),
        readTenant(env, "Services", t), readTenant(env, "Invoices", t),
      ]);
      const svc = Object.fromEntries(services.map((s) => [s.serviceId, s]));
      const billed = new Set(invoices.map((i) => i.bookingId));
      let created = 0;
      for (const sh of shifts) {
        if (sh.status !== "completed") continue;
        if (billed.has(sh.bookingId)) continue;
        const b = bookings.find((x) => x.bookingId === sh.bookingId);
        if (!b) continue;
        const amount = invoiceAmount(svc[b.serviceId], sh);
        await insert(env, "Invoices", {
          invoiceId: genId("inv"), tenantId: t, householdId: b.householdId,
          bookingId: sh.bookingId, amount: amount.toFixed(2), status: "unpaid",
          stripeId: "", createdAt: new Date().toISOString(),
        });
        billed.add(sh.bookingId);
        created++;
      }
      return json({ ok: true, created });
    }

    if (body.action === "mark_paid" || body.action === "void") {
      if (!body.invoiceId) return json({ error: "invoiceId required" }, 400);
      const status = body.action === "void" ? "void" : "paid";
      const ok = await updateWhere(env, "Invoices", "invoiceId", body.invoiceId, { status });
      return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
