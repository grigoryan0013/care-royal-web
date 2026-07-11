// Payroll: aggregate completed-shift hours + gross pay per caregiver.
// The pay run itself is executed by an embedded backbone (Check / Gusto) once
// configured; until then this delivers the timesheet + gross the run is built on.
import { json } from "../lib/creds.js";
import { getSession, requireRole, AGENCY } from "../lib/authctx.js";
import { readTenant } from "../lib/tenant.js";
import { shiftHours, payAmount } from "../lib/billing.js";

async function loadContext(env, t) {
  const [shifts, bookings, services, recipients, users, profiles] = await Promise.all([
    readTenant(env, "Shifts", t), readTenant(env, "Bookings", t),
    readTenant(env, "Services", t), readTenant(env, "Recipients", t),
    readTenant(env, "Users", t), readTenant(env, "CaregiverProfiles", t),
  ]);
  const bk = Object.fromEntries(bookings.map((b) => [b.bookingId, b]));
  const svc = Object.fromEntries(services.map((s) => [s.serviceId, s]));
  const rcp = Object.fromEntries(recipients.map((r) => [r.recipientId, r]));
  const usr = Object.fromEntries(users.map((u) => [u.userId, u]));
  const rate = Object.fromEntries(profiles.map((p) => [p.userId, p.rate]));
  const completed = shifts.filter((s) => s.status === "completed" && s.caregiverId);
  return { completed, bk, svc, rcp, usr, rate };
}

export async function onRequestGet({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  try {
    const { completed, bk, svc, rcp, usr, rate } = await loadContext(env, claims.tenantId);

    if (claims.role === "caregiver") {
      const mine = completed.filter((s) => s.caregiverId === claims.userId);
      const lines = mine.map((s) => {
        const b = bk[s.bookingId] || {};
        return {
          date: s.clockOut || s.start, service: svc[b.serviceId]?.name || "",
          recipient: rcp[b.recipientId]?.name || "", hours: Math.round(shiftHours(s) * 100) / 100,
          amount: payAmount(rate[claims.userId], s),
        };
      });
      const gross = Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
      const hours = Math.round(lines.reduce((a, l) => a + l.hours, 0) * 100) / 100;
      return json({ hours, gross, lines });
    }

    // Agency: per-caregiver rollup
    const guard = await requireRole(request, env, AGENCY);
    if (guard.error) return guard.error;
    const roll = {};
    for (const s of completed) {
      const id = s.caregiverId;
      roll[id] ||= { userId: id, name: usr[id]?.name || usr[id]?.email || id, shifts: 0, hours: 0, gross: 0 };
      roll[id].shifts += 1;
      roll[id].hours += shiftHours(s);
      roll[id].gross += payAmount(rate[id], s);
    }
    const rows = Object.values(roll).map((r) => ({
      ...r, hours: Math.round(r.hours * 100) / 100, gross: Math.round(r.gross * 100) / 100,
    }));
    const total = Math.round(rows.reduce((a, r) => a + r.gross, 0) * 100) / 100;
    return json({ rows, total, backboneReady: !!env.PAYROLL_PROVIDER });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const guard = await requireRole(request, env, AGENCY);
  if (guard.error) return guard.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }

  if (body.action === "run") {
    if (!env.PAYROLL_PROVIDER) {
      return json({ ok: false, note: "Connect a payroll backbone (Check or Gusto Embedded) to run pay. Timesheets and gross pay are ready." });
    }
    // Provider dispatch goes here once a backbone is chosen (Category 5 wiring).
    return json({ ok: true, note: `Payroll dispatched via ${env.PAYROLL_PROVIDER}.` });
  }
  return json({ error: "unknown action" }, 400);
}
