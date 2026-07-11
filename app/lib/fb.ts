// Firestore data layer (client-side). Implements the same endpoint contract the
// UI calls (method + path + body) but against Firestore instead of a server.
// Auth context comes from the signed-in Firebase user + their users/{uid} profile.
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { DEFAULT_SERVICES } from "./catalog";

type Row = Record<string, any>;

let _profile: { uid: string; tenantId: string; role: string; name: string; email: string } | null = null;
export function clearProfileCache() { _profile = null; }

async function me() {
  const u = auth().currentUser;
  if (!u) throw new Error("not signed in");
  if (_profile && _profile.uid === u.uid) return _profile;
  const snap = await getDoc(doc(db(), "users", u.uid));
  const d: Row = snap.exists() ? (snap.data() as Row) : {};
  _profile = {
    uid: u.uid, tenantId: d.tenantId || "", role: d.role || "family",
    name: d.name || u.email || "", email: u.email || "",
  };
  return _profile;
}

async function readCol(name: string, tenantId: string): Promise<Row[]> {
  const snap = await getDocs(query(collection(db(), name), where("tenantId", "==", tenantId)));
  return snap.docs.map((d) => ({ ...(d.data() as Row), _id: d.id }));
}
async function create(name: string, idField: string, data: Row) {
  const ref = doc(collection(db(), name));
  const full = { ...data, [idField]: ref.id };
  await setDoc(ref, full);
  return full;
}
async function update(name: string, id: string, patch: Row) {
  await updateDoc(doc(db(), name, id), patch);
}
const now = () => new Date().toISOString();
const ok = () => ({ ok: true });
const byId = (rows: Row[], field: string, val: string) => rows.find((r) => r[field] === val);
const hours = (s: Row) => (s.clockIn && s.clockOut ? Math.max(0, (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / 3600000) : 0);

export async function fbHandle(method: string, path: string, body: Row = {}): Promise<any> {
  const p = path.split("?")[0];
  const qs = new URLSearchParams(path.split("?")[1] || "");

  // Public waitlist — no auth required.
  if (p === "/api/waitlist" && method === "POST") {
    await create("waitlist", "waitlistId", {
      type: body.type === "agency" ? "agency" : "direct", name: body.name || "", email: body.email || "",
      phone: body.phone || "", region: body.region || "", timeframe: body.timeframe || "",
      details: JSON.stringify(body.details || {}), consent: "yes", createdAt: now(),
    });
    return ok();
  }

  const m = await me();
  const T = m.tenantId;

  if (p === "/api/auth" && method === "GET") {
    return { user: { userId: m.uid, tenantId: T, email: m.email, role: m.role, name: m.name } };
  }

  // ---- services
  if (p === "/api/services" && method === "GET") return { services: await readCol("services", T) };
  if (p === "/api/services" && method === "POST") {
    if (body.action === "seed") {
      const existing = await readCol("services", T);
      if (existing.length) return { ok: true, seeded: 0 };
      for (const s of DEFAULT_SERVICES) {
        await create("services", "serviceId", { tenantId: T, category: s.category, name: s.name, profileType: s.profileType, pricingModel: s.pricingModel, rate: "", credential: s.credential, durationMin: String(s.durationMin), active: "true" });
      }
      return { ok: true, seeded: DEFAULT_SERVICES.length };
    }
    if (body.action === "create") {
      const svc = await create("services", "serviceId", { tenantId: T, category: body.category || "Custom", name: body.name || "Untitled", profileType: body.profileType || "person", pricingModel: body.pricingModel || "hourly", rate: body.rate || "", credential: body.credential || "none", durationMin: String(body.durationMin || 60), active: "true" });
      return { ok: true, service: svc };
    }
    if (body.action === "update") {
      const patch: Row = {};
      for (const k of ["category", "name", "profileType", "pricingModel", "rate", "credential", "durationMin", "active"]) if (k in body) patch[k] = String(body[k]);
      await update("services", body.serviceId, patch);
      return ok();
    }
  }

  // ---- household (family)
  if (p === "/api/household") {
    const households = await readCol("households", T);
    const mine = households.filter((h) => h.primaryUserId === m.uid);
    if (method === "GET") {
      const hh = mine[0] || null;
      const recipients = hh ? (await readCol("recipients", T)).filter((r) => r.householdId === hh.householdId) : [];
      const members = hh ? (await readCol("householdMembers", T)).filter((x) => x.householdId === hh.householdId) : [];
      return { household: hh, recipients, members };
    }
    // POST
    let hh = mine[0];
    if (!hh) hh = await create("households", "householdId", { tenantId: T, primaryUserId: m.uid, name: "", address: "", city: "", zip: "", createdAt: now() });
    if (body.action === "ensure") {
      await update("households", hh.householdId, { name: body.name || hh.name || "", address: body.address || "", city: body.city || "", zip: body.zip || "" });
      return { ok: true, household: hh };
    }
    if (body.action === "add_recipient") {
      const r = await create("recipients", "recipientId", { tenantId: T, householdId: hh.householdId, name: body.name || "Unnamed", type: ["person", "pet", "home"].includes(body.type) ? body.type : "person", dob: body.dob || "", address: body.address || "", conditions: body.conditions || "", notes: body.notes || "", photoUrl: "", createdAt: now() });
      return { ok: true, recipient: r };
    }
    if (body.action === "update_recipient") {
      const patch: Row = {};
      for (const k of ["name", "type", "dob", "address", "conditions", "notes"]) if (k in body) patch[k] = String(body[k]);
      await update("recipients", body.recipientId, patch);
      return ok();
    }
    if (body.action === "invite") return { ok: true }; // member invite: agency-managed for now
  }

  // ---- bookings
  if (p === "/api/bookings") {
    const [bookings, services, recipients, households] = await Promise.all([readCol("bookings", T), readCol("services", T), readCol("recipients", T), readCol("households", T)]);
    if (method === "GET") {
      let list = bookings;
      if (m.role === "family") { const ids = households.filter((h) => h.primaryUserId === m.uid).map((h) => h.householdId); list = list.filter((b) => ids.includes(b.householdId)); }
      else if (m.role === "caregiver") list = list.filter((b) => b.caregiverId === m.uid);
      const enriched = list.map((b) => ({ ...b, serviceName: byId(services, "serviceId", b.serviceId)?.name || "", recipientName: byId(recipients, "recipientId", b.recipientId)?.name || "", recipientType: byId(recipients, "recipientId", b.recipientId)?.type || "", householdName: byId(households, "householdId", b.householdId)?.name || "", credential: byId(services, "serviceId", b.serviceId)?.credential || "none" } as Row)).sort((a, b) => (a.start < b.start ? 1 : -1));
      return { bookings: enriched };
    }
    if (body.action === "create") {
      const hh = households.filter((h) => h.primaryUserId === m.uid)[0];
      if (!hh) return { error: "set up your household first" };
      await create("bookings", "bookingId", { tenantId: T, householdId: hh.householdId, recipientId: body.recipientId, serviceId: body.serviceId, requestedBy: m.uid, status: "requested", start: body.start, end: body.end || "", recurrence: "none", caregiverId: "", notes: body.notes || "", createdAt: now() });
      return ok();
    }
    if (body.action === "approve") {
      const b = byId(bookings, "bookingId", body.bookingId);
      await update("bookings", body.bookingId, { status: "scheduled", caregiverId: body.caregiverId || "" });
      await create("shifts", "shiftId", { tenantId: T, bookingId: body.bookingId, caregiverId: body.caregiverId || "", start: b?.start || "", end: b?.end || "", status: body.caregiverId ? "scheduled" : "open", clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "" });
      return ok();
    }
    if (body.action === "decline") { await update("bookings", body.bookingId, { status: "declined" }); return ok(); }
  }

  // ---- agency aggregate
  if (p === "/api/agency" && method === "GET") {
    const [households, recipients, users, profiles] = await Promise.all([readCol("households", T), readCol("recipients", T), readCol("users", T), readCol("caregiverProfiles", T)]);
    const clients = households.map((h) => ({ ...h, recipients: recipients.filter((r) => r.householdId === h.householdId) }));
    const caregivers = users.filter((u) => u.role === "caregiver").map((u) => ({ userId: u.userId || u._id, name: u.name, email: u.email, phone: u.phone || "", credentials: byId(profiles, "userId", u.userId || u._id)?.credentials || "", status: "active" }));
    return { clients, caregivers };
  }

  // ---- shifts
  if (p === "/api/shifts") {
    const [shifts, bookings, services, recipients, households, users] = await Promise.all([readCol("shifts", T), readCol("bookings", T), readCol("services", T), readCol("recipients", T), readCol("households", T), readCol("users", T)]);
    const enrich = (s: Row) => { const b = byId(bookings, "bookingId", s.bookingId) || {}; const r = byId(recipients, "recipientId", b.recipientId) || {}; const h = byId(households, "householdId", b.householdId) || {}; return { ...s, householdId: b.householdId || "", serviceName: byId(services, "serviceId", b.serviceId)?.name || "", recipientName: r.name || "", recipientType: r.type || "", careNotes: [r.conditions, r.notes].filter(Boolean).join(" · "), address: r.address || h.address || "", city: h.city || "", householdName: h.name || "", caregiverName: byId(users, "userId", s.caregiverId)?.name || "" } as Row; };
    if (method === "GET") {
      const all = shifts.map(enrich);
      if (m.role === "caregiver") return { shifts: all.filter((s) => s.caregiverId === m.uid).sort((a, b) => (a.start < b.start ? -1 : 1)), open: all.filter((s) => s.status === "open") };
      if (m.role === "family") { const ids = households.filter((h) => h.primaryUserId === m.uid).map((h) => h.householdId); return { shifts: all.filter((s) => ids.includes(s.householdId)).sort((a, b) => (a.start < b.start ? 1 : -1)) }; }
      return { shifts: all.sort((a, b) => (a.start < b.start ? -1 : 1)) };
    }
    const s = byId(shifts, "shiftId", body.shiftId);
    if (!s) return { error: "not found" };
    if (body.action === "claim") { await update("shifts", body.shiftId, { caregiverId: m.uid, status: "scheduled" }); await update("bookings", s.bookingId, { caregiverId: m.uid }); return ok(); }
    if (body.action === "clock_in") { await update("shifts", body.shiftId, { clockIn: now(), gpsIn: body.gps || "", status: "in_progress" }); return ok(); }
    if (body.action === "clock_out") { await update("shifts", body.shiftId, { clockOut: now(), gpsOut: body.gps || "", status: "completed", notes: body.notes ? (s.notes ? `${s.notes}\n${body.notes}` : body.notes) : s.notes }); await update("bookings", s.bookingId, { status: "completed" }); return ok(); }
    if (body.action === "assign") { await update("shifts", body.shiftId, { caregiverId: body.caregiverId || "", status: body.caregiverId ? "scheduled" : "open" }); return ok(); }
  }

  // ---- invoices
  if (p === "/api/invoices") {
    const [invoices, bookings, services, recipients, households] = await Promise.all([readCol("invoices", T), readCol("bookings", T), readCol("services", T), readCol("recipients", T), readCol("households", T)]);
    if (method === "GET") {
      let list = invoices;
      if (m.role === "family") { const ids = households.filter((h) => h.primaryUserId === m.uid).map((h) => h.householdId); list = list.filter((i) => ids.includes(i.householdId)); }
      const enriched = list.map((inv) => { const b = byId(bookings, "bookingId", inv.bookingId) || {}; return { ...inv, serviceName: byId(services, "serviceId", b.serviceId)?.name || "", recipientName: byId(recipients, "recipientId", b.recipientId)?.name || "", householdName: byId(households, "householdId", inv.householdId)?.name || "" } as Row; }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { invoices: enriched };
    }
    if (body.action === "generate") {
      const shifts = await readCol("shifts", T);
      const billed = new Set(invoices.map((i) => i.bookingId));
      let created = 0;
      for (const s of shifts) {
        if (s.status !== "completed" || billed.has(s.bookingId)) continue;
        const b = byId(bookings, "bookingId", s.bookingId); if (!b) continue;
        const svc = byId(services, "serviceId", b.serviceId);
        const amt = svc && svc.pricingModel === "hourly" ? parseFloat(svc.rate || "0") * (hours(s) || 1) : parseFloat(svc?.rate || "0");
        await create("invoices", "invoiceId", { tenantId: T, householdId: b.householdId, bookingId: b.bookingId, amount: (Math.round(amt * 100) / 100).toFixed(2), status: "unpaid", stripeId: "", createdAt: now() });
        billed.add(b.bookingId); created++;
      }
      return { ok: true, created };
    }
    if (body.action === "mark_paid" || body.action === "void") { await update("invoices", body.invoiceId, { status: body.action === "void" ? "void" : "paid" }); return ok(); }
    if (body.action === "pay") return { error: "Online payment isn't enabled yet. Your agency will mark this paid." };
  }

  // ---- payroll
  if (p === "/api/payroll") {
    const [shifts, bookings, services, recipients, users, profiles] = await Promise.all([readCol("shifts", T), readCol("bookings", T), readCol("services", T), readCol("recipients", T), readCol("users", T), readCol("caregiverProfiles", T)]);
    const completed = shifts.filter((s) => s.status === "completed" && s.caregiverId);
    const rate = (uid: string) => parseFloat(byId(profiles, "userId", uid)?.rate || "0") || 0;
    if (method === "GET" && m.role === "caregiver") {
      const mine = completed.filter((s) => s.caregiverId === m.uid);
      const lines = mine.map((s) => { const b = byId(bookings, "bookingId", s.bookingId) || {}; return { date: s.clockOut || s.start, service: byId(services, "serviceId", b.serviceId)?.name || "", recipient: byId(recipients, "recipientId", b.recipientId)?.name || "", hours: Math.round(hours(s) * 100) / 100, amount: Math.round(rate(m.uid) * (hours(s) || 1) * 100) / 100 }; });
      return { hours: Math.round(lines.reduce((a, l) => a + l.hours, 0) * 100) / 100, gross: Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100, lines };
    }
    if (method === "GET") {
      const roll: Row = {};
      for (const s of completed) { const r = (roll[s.caregiverId] ||= { userId: s.caregiverId, name: byId(users, "userId", s.caregiverId)?.name || s.caregiverId, shifts: 0, hours: 0, gross: 0 }); r.shifts++; r.hours += hours(s); r.gross += rate(s.caregiverId) * (hours(s) || 1); }
      const rows = Object.values(roll).map((r: any) => ({ ...r, hours: Math.round(r.hours * 100) / 100, gross: Math.round(r.gross * 100) / 100 }));
      return { rows, total: Math.round(rows.reduce((a, r: any) => a + r.gross, 0) * 100) / 100, backboneReady: false };
    }
    return { ok: false, note: "Connect a payroll backbone to issue payouts. Timesheets and gross pay are ready." };
  }

  // ---- connect (Stripe) — deferred in front-end-only mode
  if (p === "/api/connect" && method === "POST") {
    if (body.action === "status") return { connected: false };
    if (body.action === "onboard") return { error: "Payments setup is coming soon." };
  }

  // ---- documents
  if (p === "/api/documents") {
    const [docs, households, recipients] = await Promise.all([readCol("documents", T), readCol("households", T), readCol("recipients", T)]);
    if (method === "GET") {
      let list = docs;
      if (m.role === "family") { const ids = households.filter((h) => h.primaryUserId === m.uid).map((h) => h.householdId); list = list.filter((d) => ids.includes(d.householdId)); }
      else if (m.role === "caregiver") list = list.filter((d) => d.subjectType === "caregiver" && d.subjectId === m.uid);
      const enriched = list.map((d) => ({ ...d, templateLabel: d.title, householdName: byId(households, "householdId", d.householdId)?.name || "", recipientName: d.subjectType === "recipient" ? (byId(recipients, "recipientId", d.subjectId)?.name || "") : "" } as Row)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { documents: enriched };
    }
    if (body.action === "create") {
      const titles: Row = { service_agreement: "Service Agreement", care_plan: "Care Plan", consent: "Consent to Care", hipaa: "HIPAA Acknowledgment" };
      const hh = byId(households, "householdId", body.householdId);
      const content = `${titles[body.template]}\n\nClient household: ${hh?.name || ""}\n\nBy signing, the Client agrees to the terms above.`;
      await create("documents", "docId", { tenantId: T, subjectType: "household", subjectId: body.householdId, template: body.template, driveFileId: "", status: "unsigned", signedBy: "", signedAt: "", title: titles[body.template] || "Document", content, signature: "", householdId: body.householdId, createdAt: now() });
      return ok();
    }
    if (body.action === "sign") { await update("documents", body.docId, { status: "signed", signedBy: body.signerName || m.name, signedAt: now(), signature: body.signature || "" }); return ok(); }
  }

  // ---- leads
  if (p === "/api/leads") {
    if (method === "GET") {
      const stage = qs.get("stage") || ""; const q = (qs.get("q") || "").toLowerCase();
      let leads = await readCol("leads", T);
      const counts: Row = { new: 0, contacted: 0, consultation: 0, client: 0, lost: 0 };
      for (const l of leads) if (counts[l.stage] !== undefined) counts[l.stage]++;
      const grandTotal = leads.length;
      if (stage) leads = leads.filter((l) => l.stage === stage);
      if (q) leads = leads.filter((l) => `${l.name} ${l.email} ${l.city} ${l.zip}`.toLowerCase().includes(q));
      return { total: leads.length, grandTotal, counts, leads: leads.slice(0, 50) };
    }
    if (body.action === "import") {
      const rows = Array.isArray(body.leads) ? body.leads : [];
      for (const r of rows) await create("leads", "leadId", { tenantId: T, name: r.name || "", email: r.email || "", phone: r.phone || "", address: r.address || "", city: r.city || "", zip: r.zip || "", stage: "new", source: "import", notes: "", createdAt: now() });
      return { ok: true, imported: rows.length };
    }
    if (body.action === "update_stage") { await update("leads", body.leadId, { stage: body.stage }); return ok(); }
    if (body.action === "note") { await update("leads", body.leadId, { notes: body.notes || "" }); return ok(); }
  }

  // ---- messaging (per-household thread; agency = customer service sees all)
  if (p === "/api/threads" && method === "GET") {
    const [households, bookings, messages] = await Promise.all([readCol("households", T), readCol("bookings", T), readCol("messages", T)]);
    let hids: string[];
    if (m.role === "family") hids = households.filter((h) => h.primaryUserId === m.uid).map((h) => h.householdId);
    else if (m.role === "caregiver") hids = Array.from(new Set(bookings.filter((b) => b.caregiverId === m.uid).map((b) => b.householdId)));
    else hids = households.map((h) => h.householdId);
    const last: Row = {};
    for (const msg of messages) { const c = last[msg.householdId]; if (!c || msg.createdAt > c.createdAt) last[msg.householdId] = msg; }
    const threads = hids.map((hid) => ({ householdId: hid, name: byId(households, "householdId", hid)?.name || "Client", lastText: last[hid]?.text || "", lastAt: last[hid]?.createdAt || "" })).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    return { threads };
  }
  if (p === "/api/messages" && method === "GET") {
    const hid = qs.get("householdId") || "";
    const msgs = (await readCol("messages", T)).filter((x) => x.householdId === hid).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return { messages: msgs };
  }
  if (p === "/api/messages" && method === "POST") {
    await create("messages", "messageId", { tenantId: T, householdId: body.householdId, fromUid: m.uid, fromName: m.name, fromRole: m.role, text: body.text || "", createdAt: now() });
    return ok();
  }

  return { error: `fb: unhandled ${method} ${p}` };
}
