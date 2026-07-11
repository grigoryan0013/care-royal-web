// Family household: get-or-create, care recipients, and member invites.
import { json } from "../lib/creds.js";
import { getSession } from "../lib/authctx.js";
import { readTenant, insert, updateWhere, genId, findUserByEmail } from "../lib/tenant.js";

// Resolve the caller's household (they are the primary owner). Create if missing.
async function myHousehold(env, claims, createName) {
  const all = await readTenant(env, "Households", claims.tenantId);
  let hh = all.find((h) => h.primaryUserId === claims.userId);
  if (!hh && createName !== undefined) {
    hh = {
      householdId: genId("hh"), tenantId: claims.tenantId, primaryUserId: claims.userId,
      name: createName || claims.name || "My household", address: "", city: "", zip: "",
      createdAt: new Date().toISOString(),
    };
    await insert(env, "Households", hh);
  }
  return hh || null;
}

// GET /api/household -> { household, recipients, members }
export async function onRequestGet({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  try {
    const hh = await myHousehold(env, claims);
    if (!hh) return json({ household: null, recipients: [], members: [] });
    const recipients = (await readTenant(env, "Recipients", claims.tenantId)).filter((r) => r.householdId === hh.householdId);
    const members = (await readTenant(env, "HouseholdMembers", claims.tenantId)).filter((m) => m.householdId === hh.householdId);
    return json({ household: hh, recipients, members });
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
    if (body.action === "ensure") {
      const hh = await myHousehold(env, claims, body.name || "");
      if (body.address !== undefined) {
        await updateWhere(env, "Households", "householdId", hh.householdId, {
          address: body.address || "", city: body.city || "", zip: body.zip || "",
          name: body.name || hh.name,
        });
      }
      return json({ ok: true, household: hh });
    }

    if (body.action === "add_recipient") {
      const hh = await myHousehold(env, claims, "");
      const rcp = {
        recipientId: genId("rcp"), tenantId: claims.tenantId, householdId: hh.householdId,
        name: body.name || "Unnamed", type: ["person", "pet", "home"].includes(body.type) ? body.type : "person",
        dob: body.dob || "", address: body.address || "", conditions: body.conditions || "",
        notes: body.notes || "", photoUrl: body.photoUrl || "", createdAt: new Date().toISOString(),
      };
      await insert(env, "Recipients", rcp);
      return json({ ok: true, recipient: rcp });
    }

    if (body.action === "update_recipient") {
      if (!body.recipientId) return json({ error: "recipientId required" }, 400);
      const patch = {};
      for (const k of ["name", "type", "dob", "address", "conditions", "notes", "photoUrl"]) {
        if (k in body) patch[k] = String(body[k]);
      }
      const ok = await updateWhere(env, "Recipients", "recipientId", body.recipientId, patch);
      return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    if (body.action === "invite") {
      // Link an existing family user (by email) into this household as manager/viewer.
      const hh = await myHousehold(env, claims, "");
      const invitee = await findUserByEmail(env, body.email);
      if (!invitee) return json({ error: "That person must create a Care Royal account first, then try again." }, 404);
      const role = body.memberRole === "manager" ? "manager" : "viewer";
      await insert(env, "HouseholdMembers", {
        id: genId("mem"), tenantId: claims.tenantId, householdId: hh.householdId,
        userId: invitee.userId, memberRole: role,
      });
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
