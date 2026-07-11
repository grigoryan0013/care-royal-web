// Bookings: family requests, agency approves/assigns, role-scoped listing.
import { json } from "../lib/creds.js";
import { getSession, requireRole, AGENCY } from "../lib/authctx.js";
import { readTenant, insert, updateWhere, genId } from "../lib/tenant.js";
import { notify } from "../lib/notify.js";

// Attach display names (service, recipient, household) for the UI.
function enrich(bookings, services, recipients, households) {
  const svc = Object.fromEntries(services.map((s) => [s.serviceId, s]));
  const rcp = Object.fromEntries(recipients.map((r) => [r.recipientId, r]));
  const hh = Object.fromEntries(households.map((h) => [h.householdId, h]));
  return bookings.map((b) => ({
    ...b,
    serviceName: svc[b.serviceId]?.name || "",
    recipientName: rcp[b.recipientId]?.name || "",
    recipientType: rcp[b.recipientId]?.type || "",
    householdName: hh[b.householdId]?.name || "",
    credential: svc[b.serviceId]?.credential || "none",
  }));
}

export async function onRequestGet({ request, env }) {
  const claims = await getSession(request, env);
  if (!claims) return json({ error: "not signed in" }, 401);
  try {
    const t = claims.tenantId;
    const [bookings, services, recipients, households] = await Promise.all([
      readTenant(env, "Bookings", t), readTenant(env, "Services", t),
      readTenant(env, "Recipients", t), readTenant(env, "Households", t),
    ]);
    let mine = bookings;
    if (claims.role === "family") {
      const myHouseholds = households.filter((h) => h.primaryUserId === claims.userId).map((h) => h.householdId);
      mine = bookings.filter((b) => myHouseholds.includes(b.householdId));
    } else if (claims.role === "caregiver") {
      mine = bookings.filter((b) => b.caregiverId === claims.userId);
    }
    const enriched = enrich(mine, services, recipients, households)
      .sort((a, b) => (a.start < b.start ? 1 : -1));
    return json({ bookings: enriched });
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
    // Family creates a request
    if (body.action === "create") {
      if (claims.role !== "family") return json({ error: "only family can request bookings" }, 403);
      const households = (await readTenant(env, "Households", claims.tenantId)).filter((h) => h.primaryUserId === claims.userId);
      if (!households.length) return json({ error: "set up your household first" }, 400);
      if (!body.recipientId || !body.serviceId || !body.start) return json({ error: "missing fields" }, 400);
      const bk = {
        bookingId: genId("bk"), tenantId: claims.tenantId, householdId: households[0].householdId,
        recipientId: body.recipientId, serviceId: body.serviceId, requestedBy: claims.userId,
        status: "requested", start: body.start, end: body.end || "", recurrence: body.recurrence || "none",
        caregiverId: "", notes: body.notes || "", createdAt: new Date().toISOString(),
      };
      await insert(env, "Bookings", bk);
      // Notify agency admins of the new request.
      const admins = (await readTenant(env, "Users", claims.tenantId)).filter((u) => u.role === "agency_admin");
      for (const a of admins) {
        await notify(env, a.email, "New booking request", `${claims.name || "A family"} requested a booking. Review it in your agency approvals queue.`);
      }
      return json({ ok: true, booking: bk });
    }

    // Agency approve/assign or decline
    const guard = await requireRole(request, env, AGENCY);
    if (guard.error) return guard.error;

    if (body.action === "approve") {
      if (!body.bookingId) return json({ error: "bookingId required" }, 400);
      const caregiverId = body.caregiverId || "";
      const ok = await updateWhere(env, "Bookings", "bookingId", body.bookingId, {
        status: "scheduled", caregiverId,
      });
      if (!ok) return json({ error: "not found" }, 404);
      // Generate the shift. Unassigned -> open (claimable); assigned -> scheduled.
      const booking = (await readTenant(env, "Bookings", claims.tenantId)).find((b) => b.bookingId === body.bookingId);
      await insert(env, "Shifts", {
        shiftId: genId("sh"), tenantId: claims.tenantId, bookingId: body.bookingId,
        caregiverId, start: booking?.start || "", end: booking?.end || "",
        status: caregiverId ? "scheduled" : "open",
        clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "",
      });
      // Notify the family member who requested it.
      if (booking?.requestedBy) {
        const requester = (await readTenant(env, "Users", claims.tenantId)).find((u) => u.userId === booking.requestedBy);
        if (requester) await notify(env, requester.email, "Your booking was approved", "Your care booking has been scheduled. You can see it in your Care Royal bookings.");
      }
      return json({ ok: true });
    }
    if (body.action === "decline") {
      if (!body.bookingId) return json({ error: "bookingId required" }, 400);
      const ok = await updateWhere(env, "Bookings", "bookingId", body.bookingId, { status: "declined" });
      return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
