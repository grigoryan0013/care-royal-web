// Care Royal auth: login, self-serve signup (family/caregiver), session, and a
// one-time guarded bootstrap that creates the tabs + first tenant + first admin.
import { json, jwtSecret } from "../lib/creds.js";
import { hashSecret, verifySecret } from "../lib/pw.js";
import { signUserJwt, verifyUserJwt } from "../lib/jwtUser.js";
import {
  ROLES, genId, insert, ensureAllTabs,
  findUserByEmail, getTenantBySlug,
} from "../lib/tenant.js";

function publicUser(u) {
  return { userId: u.userId, tenantId: u.tenantId, email: u.email, role: u.role, name: u.name };
}

async function issue(env, user) {
  const token = await signUserJwt(
    { sub: user.email, tenantId: user.tenantId, role: user.role, userId: user.userId, name: user.name },
    jwtSecret(env)
  );
  return { token, user: publicUser(user) };
}

// GET /api/auth  -> verify Bearer token, return the session user.
export async function onRequestGet({ request, env }) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const claims = await verifyUserJwt(token, jwtSecret(env));
  if (!claims) return json({ error: "invalid session" }, 401);
  return json({ user: { userId: claims.userId, tenantId: claims.tenantId, email: claims.sub, role: claims.role, name: claims.name } });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const action = body.action;

  try {
    if (action === "bootstrap") {
      if (!env.BOOTSTRAP_SECRET || body.secret !== env.BOOTSTRAP_SECRET) {
        return json({ error: "unauthorized" }, 401);
      }
      const created = await ensureAllTabs(env);
      const slug = String(body.slug || "").trim().toLowerCase();
      if (!slug || !body.tenantName) return json({ error: "tenantName and slug required" }, 400);
      const existing = await getTenantBySlug(env, slug);
      let tenantId;
      if (existing) {
        tenantId = existing.tenantId;
      } else {
        tenantId = genId("ten");
        await insert(env, "Tenants", {
          tenantId, name: body.tenantName, slug, plan: "standard",
          status: "active", stripeAccountId: "", createdAt: new Date().toISOString(),
        });
      }
      if (body.adminEmail && body.adminPassword) {
        const dupe = await findUserByEmail(env, body.adminEmail);
        if (!dupe) {
          await insert(env, "Users", {
            userId: genId("usr"), tenantId, email: String(body.adminEmail).trim().toLowerCase(),
            passHash: await hashSecret(body.adminPassword), role: ROLES.AGENCY_ADMIN,
            name: body.adminName || "Owner", phone: "", status: "active",
            createdAt: new Date().toISOString(),
          });
        }
      }
      return json({ ok: true, tabsCreated: created, tenantId });
    }

    if (action === "signup") {
      const { tenantSlug, email, password, name } = body;
      const role = body.role === ROLES.CAREGIVER ? ROLES.CAREGIVER : ROLES.FAMILY;
      if (!tenantSlug || !email || !password) return json({ error: "missing fields" }, 400);
      const tenant = await getTenantBySlug(env, tenantSlug);
      if (!tenant) return json({ error: "agency not found" }, 404);
      if (await findUserByEmail(env, email)) return json({ error: "email already registered" }, 409);
      const user = {
        userId: genId("usr"), tenantId: tenant.tenantId, email: String(email).trim().toLowerCase(),
        passHash: await hashSecret(password), role, name: name || "",
        phone: body.phone || "", status: "active", createdAt: new Date().toISOString(),
      };
      await insert(env, "Users", user);
      if (role === ROLES.CAREGIVER) {
        await insert(env, "CaregiverProfiles", {
          userId: user.userId, tenantId: tenant.tenantId, credentials: "", rate: "", bio: "", status: "pending",
        });
      }
      return json(await issue(env, user));
    }

    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return json({ error: "missing fields" }, 400);
      const user = await findUserByEmail(env, email);
      if (!user || !(await verifySecret(password, user.passHash))) {
        return json({ error: "invalid email or password" }, 401);
      }
      if (user.status && user.status !== "active") return json({ error: "account inactive" }, 403);
      return json(await issue(env, user));
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
