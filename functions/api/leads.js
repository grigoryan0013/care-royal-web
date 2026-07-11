// Lead pipeline (the 14k inquiry list). Agency-only. Bulk import, paginated
// list with search + stage filter, stage updates, and convert.
import { json } from "../lib/creds.js";
import { requireRole, AGENCY } from "../lib/authctx.js";
import { readTenant, insertMany, updateWhere, genId } from "../lib/tenant.js";

const STAGES = ["new", "contacted", "consultation", "client", "lost"];

export async function onRequestGet({ request, env }) {
  const guard = await requireRole(request, env, AGENCY);
  if (guard.error) return guard.error;
  const url = new URL(request.url);
  const stage = url.searchParams.get("stage") || "";
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  try {
    let leads = await readTenant(env, "Leads", guard.claims.tenantId);
    if (stage) leads = leads.filter((l) => l.stage === stage);
    if (q) leads = leads.filter((l) => `${l.name} ${l.email} ${l.city} ${l.zip}`.toLowerCase().includes(q));
    const counts = {};
    for (const s of STAGES) counts[s] = 0;
    const all = await readTenant(env, "Leads", guard.claims.tenantId);
    for (const l of all) if (counts[l.stage] !== undefined) counts[l.stage]++;
    return json({
      total: leads.length, grandTotal: all.length, counts,
      leads: leads.slice(offset, offset + limit),
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const guard = await requireRole(request, env, AGENCY);
  if (guard.error) return guard.error;
  const t = guard.claims.tenantId;
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  try {
    if (body.action === "import") {
      const rows = Array.isArray(body.leads) ? body.leads : [];
      if (!rows.length) return json({ ok: true, imported: 0 });
      const now = new Date().toISOString();
      const objs = rows.map((r) => ({
        leadId: genId("lead"), tenantId: t,
        name: r.name || "", email: r.email || "", phone: r.phone || "",
        address: r.address || "", city: r.city || "", zip: r.zip || "",
        stage: "new", source: r.source || "import", notes: r.notes || "", createdAt: now,
      }));
      const n = await insertMany(env, "Leads", objs);
      return json({ ok: true, imported: n });
    }

    if (body.action === "update_stage") {
      if (!body.leadId || !STAGES.includes(body.stage)) return json({ error: "leadId and valid stage required" }, 400);
      const ok = await updateWhere(env, "Leads", "leadId", body.leadId, { stage: body.stage });
      return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    if (body.action === "note") {
      if (!body.leadId) return json({ error: "leadId required" }, 400);
      const ok = await updateWhere(env, "Leads", "leadId", body.leadId, { notes: body.notes || "" });
      return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
