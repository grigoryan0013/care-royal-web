// Parse the Google service-account JSON from env and expose shared config.
// GOOGLE_SERVICE_ACCOUNT is the full service-account JSON (as a single-line string).
export function getCreds(env) {
  const raw = env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT not set");
  const creds = typeof raw === "string" ? JSON.parse(raw) : raw;
  // Cloudflare secrets often escape newlines in the PEM; restore them.
  if (creds.private_key && creds.private_key.includes("\\n")) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }
  return creds;
}

export function masterSheetId(env) {
  const id = env.MASTER_SHEET_ID;
  if (!id) throw new Error("MASTER_SHEET_ID not set");
  return id;
}

export function jwtSecret(env) {
  const s = env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("ADMIN_JWT_SECRET not set");
  return s;
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
