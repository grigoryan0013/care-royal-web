// Service-account -> Google access token (Cloudflare Workers / Web Crypto).
// Reused from the PGL project.
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  let str = atob(b64);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf.buffer;
}

function b64url(input) {
  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new TextEncoder().encode(typeof input === "string" ? input : JSON.stringify(input));
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function getAccessToken(clientEmail, privateKeyPem, scope, subject = null) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail, scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now,
    ...(subject ? { sub: subject } : {}),
  };

  const header = b64url({ alg: "RS256", typ: "JWT" });
  const body = b64url(payload);
  const signing = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    "pkcs8", pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signing));
  const jwt = `${signing}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token;
}
