// Care Royal data layer over the master Google Sheet.
// Single source of truth for every tab's columns. All reads/writes go through here
// so the frontend never knows it's a spreadsheet (and we can swap the store later).
import { getRows, appendRow, appendValues, ensureSheetTab, updateValues, findRowIndex } from "./sheets.js";
import { getCreds, masterSheetId } from "./creds.js";

// tab -> ordered column headers. Add columns only at the END to stay backward-safe.
export const TABS = {
  Tenants: ["tenantId", "name", "slug", "plan", "status", "stripeAccountId", "createdAt"],
  Users: ["userId", "tenantId", "email", "passHash", "role", "name", "phone", "status", "createdAt"],
  Households: ["householdId", "tenantId", "primaryUserId", "name", "address", "city", "zip", "createdAt"],
  HouseholdMembers: ["id", "tenantId", "householdId", "userId", "memberRole"],
  Recipients: ["recipientId", "tenantId", "householdId", "name", "type", "dob", "address", "conditions", "notes", "photoUrl", "createdAt"],
  Services: ["serviceId", "tenantId", "category", "name", "profileType", "pricingModel", "rate", "credential", "durationMin", "active"],
  CaregiverProfiles: ["userId", "tenantId", "credentials", "rate", "bio", "status"],
  Bookings: ["bookingId", "tenantId", "householdId", "recipientId", "serviceId", "requestedBy", "status", "start", "end", "recurrence", "caregiverId", "notes", "createdAt"],
  Shifts: ["shiftId", "tenantId", "bookingId", "caregiverId", "start", "end", "status", "clockIn", "clockOut", "gpsIn", "gpsOut", "notes"],
  Invoices: ["invoiceId", "tenantId", "householdId", "bookingId", "amount", "status", "stripeId", "createdAt"],
  Documents: ["docId", "tenantId", "subjectType", "subjectId", "template", "driveFileId", "status", "signedBy", "signedAt", "title", "content", "signature", "householdId", "createdAt"],
  Leads: ["leadId", "tenantId", "name", "email", "phone", "address", "city", "zip", "stage", "source", "notes", "createdAt"],
  // Public pre-launch waitlist / questionnaire submissions (not tenant-scoped).
  Waitlist: ["waitlistId", "type", "name", "email", "phone", "region", "timeframe", "details", "consent", "createdAt"],
};

// Roles used across the app.
export const ROLES = {
  AGENCY_ADMIN: "agency_admin",
  AGENCY_COORD: "agency_coord",
  CAREGIVER: "caregiver",
  FAMILY: "family",
};

export function genId(prefix) {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  let s = "";
  for (const b of rand) s += b.toString(16).padStart(2, "0");
  return `${prefix}_${s}`;
}

function objToRow(tab, obj) {
  return TABS[tab].map((h) => (obj[h] ?? "").toString());
}
function rowsToObjects(tab, rows) {
  const headers = TABS[tab];
  return rows.map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

// Read every row of a tab (skips the header row).
export async function readTable(env, tab) {
  const creds = getCreds(env);
  const rows = await getRows(masterSheetId(env), `${tab}!A2:Z`, creds);
  return rowsToObjects(tab, rows);
}

// Read a tab scoped to one tenant.
export async function readTenant(env, tab, tenantId) {
  const all = await readTable(env, tab);
  return all.filter((o) => o.tenantId === tenantId);
}

export async function insert(env, tab, obj) {
  const creds = getCreds(env);
  await appendRow(masterSheetId(env), `${tab}!A1`, objToRow(tab, obj), creds);
  return obj;
}

// Bulk insert many rows in one call (used for the lead CSV import).
export async function insertMany(env, tab, objs) {
  if (!objs.length) return 0;
  const creds = getCreds(env);
  const rows = objs.map((o) => objToRow(tab, o));
  await appendValues(masterSheetId(env), `${tab}!A1`, rows, creds);
  return rows.length;
}

// Update the row whose key column matches keyValue. Returns true if found.
export async function updateWhere(env, tab, keyCol, keyValue, patch) {
  const creds = getCreds(env);
  const headers = TABS[tab];
  const keyIdx = headers.indexOf(keyCol);
  const sheetId = masterSheetId(env);
  const rowNum = await findRowIndex(sheetId, `${tab}!A2:Z`, keyIdx, keyValue, creds);
  if (rowNum === -1) return false;
  const rows = await getRows(sheetId, `${tab}!A${rowNum}:Z${rowNum}`, creds);
  const current = rowsToObjects(tab, rows)[0] || {};
  const merged = { ...current, ...patch };
  await updateValues(sheetId, `${tab}!A${rowNum}`, [objToRow(tab, merged)], creds);
  return true;
}

// --- Convenience lookups -------------------------------------------------
export async function findUserByEmail(env, email) {
  const users = await readTable(env, "Users");
  const e = String(email || "").trim().toLowerCase();
  return users.find((u) => String(u.email).trim().toLowerCase() === e) || null;
}

export async function getTenantBySlug(env, slug) {
  const tenants = await readTable(env, "Tenants");
  return tenants.find((t) => t.slug === slug) || null;
}

export async function getTenantById(env, tenantId) {
  const tenants = await readTable(env, "Tenants");
  return tenants.find((t) => t.tenantId === tenantId) || null;
}

// Create every tab with its header row if the sheet is empty (one-time bootstrap).
export async function ensureAllTabs(env) {
  const creds = getCreds(env);
  const sheetId = masterSheetId(env);
  const created = [];
  for (const tab of Object.keys(TABS)) {
    const made = await ensureSheetTab(sheetId, tab, creds, TABS[tab]);
    if (made) created.push(tab);
  }
  return created;
}
