// Stripe Connect onboarding for the agency. Creates an Express connected account,
// stores it on the tenant, and returns the onboarding / status.
import { json } from "../lib/creds.js";
import { requireRole } from "../lib/authctx.js";
import { getTenantById, updateWhere } from "../lib/tenant.js";
import { stripeCall } from "../lib/stripe.js";

export async function onRequestPost({ request, env }) {
  const guard = await requireRole(request, env, ["agency_admin"]);
  if (guard.error) return guard.error;
  const { claims } = guard;
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const origin = new URL(request.url).origin;

  try {
    const tenant = await getTenantById(env, claims.tenantId);
    if (!tenant) return json({ error: "tenant not found" }, 404);

    if (body.action === "status") {
      if (!tenant.stripeAccountId) return json({ connected: false });
      const acct = await stripeCall(env, `accounts/${tenant.stripeAccountId}`, {});
      return json({
        connected: true, accountId: tenant.stripeAccountId,
        chargesEnabled: !!acct.charges_enabled, payoutsEnabled: !!acct.payouts_enabled,
      });
    }

    if (body.action === "onboard") {
      let accountId = tenant.stripeAccountId;
      if (!accountId) {
        const acct = await stripeCall(env, "accounts", {
          type: "express", country: "US",
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_type: "company",
        });
        accountId = acct.id;
        await updateWhere(env, "Tenants", "tenantId", claims.tenantId, { stripeAccountId: accountId });
      }
      const link = await stripeCall(env, "account_links", {
        account: accountId, type: "account_onboarding",
        refresh_url: `${origin}/agency/`, return_url: `${origin}/agency/`,
      });
      return json({ ok: true, url: link.url });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
