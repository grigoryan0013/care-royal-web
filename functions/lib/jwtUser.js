// User session JWT (HMAC-SHA256). Reused from PGL. Carries email + tenant + role.
function b64url(buf) {
  let str = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// claims: { sub: email, tenantId, role }
export async function signUserJwt(claims, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    ...claims, iat: now, exp: now + 60 * 60 * 24 * 30,
  })));
  const signing = `${header}.${payload}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signing));
  return `${signing}.${b64url(sig)}`;
}

// Returns the decoded claims if valid & unexpired, else null.
export async function verifyUserJwt(token, secret) {
  if (!token || !secret) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const signing = `${parts[0]}.${parts[1]}`;
    const key = await hmacKey(secret);
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(signing));
    if (!valid) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
