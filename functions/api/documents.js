// Documents + built-in e-sign. Agency creates from a template; the family or
// caregiver signs in-app (type/draw). Audit = signedBy + signedAt + signature.
import { json } from "../lib/creds.js";
import { getSession, requireRole, AGENCY } from "../lib/authctx.js";
import { readTenant, insert, updateWhere, genId, getTenantById } from "../lib/tenant.js";
import { renderTemplate, TEMPLATES } from "../lib/doctemplates.js";
import { notify } from "../lib/notify.js";

export async function onRequestGet({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  try {
    const t = claims.tenantId;
    const [docs, households, recipients] = await Promise.all([
      readTenant(env, "Documents", t), readTenant(env, "Households", t), readTenant(env, "Recipients", t),
    ]);
    const rcp = Object.fromEntries(recipients.map((r) => [r.recipientId, r]));
    const hh = Object.fromEntries(households.map((h) => [h.householdId, h]));
    let mine = docs;
    if (claims.role === "family") {
      const ids = households.filter((h) => h.primaryUserId === claims.userId).map((h) => h.householdId);
      mine = docs.filter((d) => ids.includes(d.householdId));
    } else if (claims.role === "caregiver") {
      mine = docs.filter((d) => d.subjectType === "caregiver" && d.subjectId === claims.userId);
    }
    const list = mine.map((d) => ({
      ...d, templateLabel: TEMPLATES[d.template] || d.template,
      householdName: hh[d.householdId]?.name || "",
      recipientName: d.subjectType === "recipient" ? (rcp[d.subjectId]?.name || "") : "",
    })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json({ documents: list });
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
    // Sign (family or caregiver)
    if (body.action === "sign") {
      if (!body.docId || !body.signature) return json({ error: "docId and signature required" }, 400);
      const docs = await readTenant(env, "Documents", claims.tenantId);
      const doc = docs.find((d) => d.docId === body.docId);
      if (!doc) return json({ error: "not found" }, 404);
      // Ownership check
      if (claims.role === "family") {
        const households = (await readTenant(env, "Households", claims.tenantId)).filter((h) => h.primaryUserId === claims.userId);
        if (!households.some((h) => h.householdId === doc.householdId)) return json({ error: "forbidden" }, 403);
      } else if (claims.role === "caregiver") {
        if (!(doc.subjectType === "caregiver" && doc.subjectId === claims.userId)) return json({ error: "forbidden" }, 403);
      } else {
        return json({ error: "agency cannot sign client documents" }, 403);
      }
      await updateWhere(env, "Documents", "docId", body.docId, {
        status: "signed", signedBy: body.signerName || claims.name || claims.sub,
        signedAt: new Date().toISOString(), signature: body.signature,
      });
      return json({ ok: true });
    }

    // Create (agency)
    const guard = await requireRole(request, env, AGENCY);
    if (guard.error) return guard.error;
    if (body.action === "create") {
      if (!body.template || !TEMPLATES[body.template]) return json({ error: "valid template required" }, 400);
      const t = claims.tenantId;
      const [households, recipients] = await Promise.all([readTenant(env, "Households", t), readTenant(env, "Recipients", t)]);
      const tenant = await getTenantById(env, t);
      const subjectType = body.subjectType || (body.recipientId ? "recipient" : "household");
      let householdId = body.householdId || "";
      let recipientName = "";
      if (subjectType === "recipient" && body.recipientId) {
        const r = recipients.find((x) => x.recipientId === body.recipientId);
        recipientName = r?.name || ""; householdId = householdId || r?.householdId || "";
      }
      const household = households.find((h) => h.householdId === householdId);
      const content = renderTemplate(body.template, {
        agencyName: tenant?.name || "Care Royal",
        householdName: household?.name || "", recipientName,
      });
      const doc = {
        docId: genId("doc"), tenantId: t, subjectType,
        subjectId: subjectType === "recipient" ? body.recipientId : (subjectType === "caregiver" ? body.subjectId : householdId),
        template: body.template, driveFileId: "", status: "unsigned", signedBy: "", signedAt: "",
        title: TEMPLATES[body.template], content, signature: "", householdId,
        createdAt: new Date().toISOString(),
      };
      await insert(env, "Documents", doc);
      // Notify the family primary user, if any.
      if (household?.primaryUserId) {
        const users = await readTenant(env, "Users", t);
        const owner = users.find((u) => u.userId === household.primaryUserId);
        if (owner) await notify(env, owner.email, "A document needs your signature", `${doc.title} is ready to review and sign in your Care Royal documents.`);
      }
      return json({ ok: true, document: doc });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
