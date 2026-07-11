// GET /api/diag — confirms which secrets are wired, without revealing them.
import { json } from "../lib/creds.js";

export async function onRequestGet({ env }) {
  return json({
    ok: true,
    env: {
      GOOGLE_SERVICE_ACCOUNT: !!env.GOOGLE_SERVICE_ACCOUNT,
      MASTER_SHEET_ID: !!env.MASTER_SHEET_ID,
      ADMIN_JWT_SECRET: !!env.ADMIN_JWT_SECRET,
      BOOTSTRAP_SECRET: !!env.BOOTSTRAP_SECRET,
      STRIPE_SECRET_KEY: !!env.STRIPE_SECRET_KEY,
    },
    time: new Date().toISOString(),
  });
}
