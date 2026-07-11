// Password hashing for Cloudflare Workers (PBKDF2-SHA256). Reused from PGL.
// Stored form: "<saltB64>:<hashB64>". Never stores plaintext.
function b64(bytes) {
  let s = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromB64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function derive(secret, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return b64(new Uint8Array(bits));
}

export async function hashSecret(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(String(secret), salt);
  return `${b64(salt)}:${hash}`;
}

export async function verifySecret(secret, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const [saltB64, hashB64] = stored.split(":");
  try {
    const hash = await derive(String(secret), fromB64(saltB64));
    return hash === hashB64;
  } catch { return false; }
}
