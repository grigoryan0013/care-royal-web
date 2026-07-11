// Stripe webhook: marks an invoice paid when its checkout completes.
import { verifyStripeSignature } from "../lib/stripe.js";
import { updateWhere } from "../lib/tenant.js";

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const sig = request.headers.get("Stripe-Signature");
  const ok = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("bad signature", { status: 400 });

  let event;
  try { event = JSON.parse(payload); } catch { return new Response("bad json", { status: 400 }); }

  try {
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const obj = event.data?.object || {};
      const invoiceId = obj.metadata?.invoiceId;
      const paymentId = obj.payment_intent || obj.id || "";
      if (invoiceId) {
        await updateWhere(env, "Invoices", "invoiceId", invoiceId, { status: "paid", stripeId: String(paymentId) });
      }
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(String(e.message || e), { status: 500 });
  }
}
