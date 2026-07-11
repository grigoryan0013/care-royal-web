// Extract and verify the session for an API request. Returns claims or null.
// claims = { sub(email), tenantId, role, userId, name, iat, exp }
import { verifyUserJwt } from "./jwtUser.js";
import { jwtSecret, json } from "./creds.js";

export async function getSession(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return verifyUserJwt(token, jwtSecret(env));
}

// Guard helper: returns { claims } or a Response to return early.
export async function requireRole(request, env, roles) {
  const claims = await getSession(request, env);
  if (!claims) return { error: json({ error: "not signed in" }, 401) };
  if (roles && roles.length && !roles.includes(claims.role)) {
    return { error: json({ error: "forbidden" }, 403) };
  }
  return { claims };
}

export const AGENCY = ["agency_admin", "agency_coord"];
