// Google Sheets read/write helpers (Cloudflare Workers). Reused from PGL.
import { getAccessToken } from "./googleAuth.js";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

async function tok(creds) {
  return getAccessToken(creds.client_email, creds.private_key, SCOPE);
}

// Ensure a tab exists; if newly created, write an optional header row.
export async function ensureSheetTab(sheetId, title, creds, headers) {
  const t = await tok(creds);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  if (res.ok) {
    if (headers && headers.length) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(title + "!A1")}?valueInputOption=RAW`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [headers] }),
      });
    }
    return true;
  }
  return false; // already exists — safe to proceed
}

export async function appendRow(sheetId, range, values, creds) {
  const t = await tok(creds);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [values] }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function appendValues(sheetId, range, values, creds) {
  const t = await tok(creds);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRows(sheetId, range, creds) {
  const t = await tok(creds);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${t}` } }
  );
  const data = await res.json();
  return data.values || [];
}

export async function updateValues(sheetId, range, values, creds) {
  const t = await tok(creds);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function clearRange(sheetId, range, creds) {
  const t = await tok(creds);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: "POST", headers: { Authorization: `Bearer ${t}` } }
  );
}

export async function updateCell(sheetId, range, value, creds) {
  const t = await tok(creds);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[value]] }),
    }
  );
}

export async function findRowIndex(sheetId, range, colIndex, matchValue, creds) {
  const rows = await getRows(sheetId, range, creds);
  const idx = rows.findIndex(r => r[colIndex] === matchValue);
  if (idx === -1) return -1;
  const startRow = parseInt((range.match(/!.*?(\d+)/) || [null, "2"])[1], 10);
  return startRow + idx;
}
