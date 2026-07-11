// Service catalog per tenant. Any tenant member can list; only agency can edit.
import { json } from "../lib/creds.js";
import { requireRole, getSession, AGENCY } from "../lib/authctx.js";
import { readTenant, insert, updateWhere, genId } from "../lib/tenant.js";
import { DEFAULT_SERVICES } from "../lib/catalog.js";

// GET /api/services -> list this tenant's services
export async function onRequestGet({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  try {
    const services = await readTenant(env, "Services", claims.tenantId);
    return json({ services });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const guard = await requireRole(request, env, AGENCY);
  if (guard.error) return guard.error;
  const { claims } = guard;
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  try {
    if (body.action === "seed") {
      const existing = await readTenant(env, "Services", claims.tenantId);
      if (existing.length) return json({ ok: true, seeded: 0, note: "already has services" });
      for (const s of DEFAULT_SERVICES) {
        await insert(env, "Services", {
          serviceId: genId("svc"), tenantId: claims.tenantId,
          category: s.category, name: s.name, profileType: s.profileType,
          pricingModel: s.pricingModel, rate: "", credential: s.credential,
          durationMin: String(s.durationMin), active: "true",
        });
      }
      return json({ ok: true, seeded: DEFAULT_SERVICES.length });
    }

    if (body.action === "create") {
      const svc = {
        serviceId: genId("svc"), tenantId: claims.tenantId,
        category: body.category || "Custom", name: body.name || "Untitled",
        profileType: body.profileType || "person", pricingModel: body.pricingModel || "hourly",
        rate: body.rate || "", credential: body.credential || "none",
        durationMin: String(body.durationMin || 60), active: "true",
      };
      await insert(env, "Services", svc);
      return json({ ok: true, service: svc });
    }

    if (body.action === "update") {
      if (!body.serviceId) return json({ error: "serviceId required" }, 400);
      const patch = {};
      for (const k of ["category", "name", "profileType", "pricingModel", "rate", "credential", "durationMin", "active"]) {
        if (k in body) patch[k] = String(body[k]);
      }
      const ok = await updateWhere(env, "Services", "serviceId", body.serviceId, patch);
      return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
