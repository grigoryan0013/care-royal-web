// Read-only aggregates for the agency console (clients + staff).
import { json } from "../lib/creds.js";
import { requireRole, AGENCY } from "../lib/authctx.js";
import { readTenant } from "../lib/tenant.js";

export async function onRequestGet({ request, env }) {
  const guard = await requireRole(request, env, AGENCY);
  if (guard.error) return guard.error;
  const t = guard.claims.tenantId;
  try {
    const [households, recipients, users, profiles] = await Promise.all([
      readTenant(env, "Households", t), readTenant(env, "Recipients", t),
      readTenant(env, "Users", t), readTenant(env, "CaregiverProfiles", t),
    ]);
    const clients = households.map((h) => ({
      ...h,
      recipients: recipients.filter((r) => r.householdId === h.householdId),
    }));
    const profById = Object.fromEntries(profiles.map((p) => [p.userId, p]));
    const caregivers = users
      .filter((u) => u.role === "caregiver")
      .map((u) => ({
        userId: u.userId, name: u.name, email: u.email, phone: u.phone,
        credentials: profById[u.userId]?.credentials || "",
        status: profById[u.userId]?.status || "active",
      }));
    return json({ clients, caregivers });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
