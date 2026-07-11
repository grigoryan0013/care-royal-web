// Shifts: caregiver schedule + clock in/out + notes; open-shift claiming;
// agency master list; family live visibility.
import { json } from "../lib/creds.js";
import { getSession, requireRole, AGENCY } from "../lib/authctx.js";
import { readTenant, updateWhere } from "../lib/tenant.js";

async function enrichAll(env, tenantId, shifts) {
  const [bookings, services, recipients, households, users] = await Promise.all([
    readTenant(env, "Bookings", tenantId), readTenant(env, "Services", tenantId),
    readTenant(env, "Recipients", tenantId), readTenant(env, "Households", tenantId),
    readTenant(env, "Users", tenantId),
  ]);
  const bk = Object.fromEntries(bookings.map((b) => [b.bookingId, b]));
  const svc = Object.fromEntries(services.map((s) => [s.serviceId, s]));
  const rcp = Object.fromEntries(recipients.map((r) => [r.recipientId, r]));
  const hh = Object.fromEntries(households.map((h) => [h.householdId, h]));
  const usr = Object.fromEntries(users.map((u) => [u.userId, u]));
  return { households, list: shifts.map((sh) => {
    const b = bk[sh.bookingId] || {};
    const r = rcp[b.recipientId] || {};
    const h = hh[b.householdId] || {};
    return {
      ...sh, householdId: b.householdId || "",
      serviceName: svc[b.serviceId]?.name || "",
      recipientName: r.name || "", recipientType: r.type || "",
      careNotes: [r.conditions, r.notes].filter(Boolean).join(" · "),
      address: r.address || h.address || "", city: h.city || "",
      householdName: h.name || "",
      caregiverName: usr[sh.caregiverId]?.name || usr[sh.caregiverId]?.email || "",
    };
  }) };
}

export async function onRequestGet({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  try {
    const all = await readTenant(env, "Shifts", claims.tenantId);
    const { list } = await enrichAll(env, claims.tenantId, all);
    if (claims.role === "caregiver") {
      return json({
        shifts: list.filter((s) => s.caregiverId === claims.userId).sort((a, b) => (a.start < b.start ? -1 : 1)),
        open: list.filter((s) => s.status === "open").sort((a, b) => (a.start < b.start ? -1 : 1)),
      });
    }
    if (claims.role === "family") {
      const mine = (await readTenant(env, "Households", claims.tenantId))
        .filter((h) => h.primaryUserId === claims.userId).map((h) => h.householdId);
      return json({ shifts: list.filter((s) => mine.includes(s.householdId)).sort((a, b) => (a.start < b.start ? 1 : -1)) });
    }
    return json({ shifts: list.sort((a, b) => (a.start < b.start ? -1 : 1)) });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const now = new Date().toISOString();

  try {
    if (["clock_in", "clock_out", "add_note", "claim"].includes(body.action)) {
      if (claims.role !== "caregiver") return json({ error: "caregivers only" }, 403);
      if (!body.shiftId) return json({ error: "shiftId required" }, 400);
      const shift = (await readTenant(env, "Shifts", claims.tenantId)).find((s) => s.shiftId === body.shiftId);
      if (!shift) return json({ error: "not found" }, 404);

      if (body.action === "claim") {
        if (shift.status !== "open") return json({ error: "shift is no longer open" }, 409);
        await updateWhere(env, "Shifts", "shiftId", shift.shiftId, { caregiverId: claims.userId, status: "scheduled" });
        await updateWhere(env, "Bookings", "bookingId", shift.bookingId, { caregiverId: claims.userId });
        return json({ ok: true });
      }
      // Remaining actions require ownership.
      if (shift.caregiverId !== claims.userId) return json({ error: "not your shift" }, 403);

      if (body.action === "clock_in") {
        await updateWhere(env, "Shifts", "shiftId", shift.shiftId, {
          clockIn: now, gpsIn: body.gps || "", status: "in_progress",
        });
        return json({ ok: true, clockIn: now });
      }
      if (body.action === "clock_out") {
        await updateWhere(env, "Shifts", "shiftId", shift.shiftId, {
          clockOut: now, gpsOut: body.gps || "", status: "completed",
          notes: body.notes ? (shift.notes ? `${shift.notes}\n${body.notes}` : body.notes) : shift.notes,
        });
        await updateWhere(env, "Bookings", "bookingId", shift.bookingId, { status: "completed" });
        return json({ ok: true, clockOut: now });
      }
      if (body.action === "add_note") {
        const merged = shift.notes ? `${shift.notes}\n${body.note}` : body.note;
        await updateWhere(env, "Shifts", "shiftId", shift.shiftId, { notes: merged });
        return json({ ok: true });
      }
    }

    // Agency can reassign a shift's caregiver.
    if (body.action === "assign") {
      const guard = await requireRole(request, env, AGENCY);
      if (guard.error) return guard.error;
      if (!body.shiftId) return json({ error: "shiftId required" }, 400);
      await updateWhere(env, "Shifts", "shiftId", body.shiftId, {
        caregiverId: body.caregiverId || "", status: body.caregiverId ? "scheduled" : "open",
      });
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
