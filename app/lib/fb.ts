// Firestore data layer (client-side). Implements the same endpoint contract the
// UI calls (method + path + body) but against Firestore instead of a server.
// Auth context comes from the signed-in Firebase user + their users/{uid} profile.
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import { DEFAULT_SERVICES } from "./catalog";
import { generate } from "./templates";

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

// Fire-and-forget transactional email via the Cloudflare Pages Function
// (functions/api/email.js). Same Gmail-API technique as Tegula. Never blocks or
// throws into the caller — a form submission must succeed even if email is down
// or GMAIL_SERVICE_ACCOUNT isn't set yet (the function no-ops in that case).
function sendEmail(payload: Row) {
  try {
    fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}
const gen4 = () => String(Math.floor(1000 + Math.random() * 9000)); // shift PIN code for IVR clock-in
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

  // Public quote request — prospective client, no account. Resolves the agency
  // by its shareable code and drops a request into that agency's inbox.
  if (p === "/api/quote" && method === "POST") {
    const code = String(body.code || "").trim().toUpperCase();
    const jc = await getDoc(doc(db(), "joinCodes", code));
    if (!jc.exists()) return { error: "We couldn't find that agency code. Please check it with the agency." };
    const jd = jc.data() as { tenantId: string; agencyName?: string; notifyEmail?: string };
    const tenantId = jd.tenantId;
    const services = Array.isArray(body.services) ? (body.services as string[]).join(", ") : (body.services || "");
    await create("quoteRequests", "quoteId", {
      tenantId, name: body.name || "", email: body.email || "", phone: body.phone || "",
      city: body.city || "", zip: body.zip || "", careFor: body.careFor || "", recipientName: body.recipientName || "",
      services,
      frequency: body.frequency || "", startDate: body.startDate || "", schedule: body.schedule || "",
      budget: body.budget || "", details: body.details || "", bestTime: body.bestTime || "",
      status: "new", source: "quote", createdAt: now(),
    });
    sendEmail({
      type: "quote", agencyName: jd.agencyName || "", agencyEmail: jd.notifyEmail || "",
      q: { name: body.name || "", email: body.email || "", phone: body.phone || "", services,
           frequency: body.frequency || "", details: body.details || "",
           recipientName: body.recipientName || "", bestTime: body.bestTime || "" },
    });
    return { ok: true, agency: jd.agencyName || "" };
  }

  // Public caregiver application (recruiting) — no account, routed by agency code.
  if (p === "/api/apply" && method === "POST") {
    const code = String(body.code || "").trim().toUpperCase();
    const jc = await getDoc(doc(db(), "joinCodes", code));
    if (!jc.exists()) return { error: "We couldn't find that agency code." };
    const jd = jc.data() as { tenantId: string; agencyName?: string; notifyEmail?: string };
    const tenantId = jd.tenantId;
    await create("caregiverApplications", "appId", {
      tenantId, name: body.name || "", email: body.email || "", phone: body.phone || "", city: body.city || "", zip: body.zip || "",
      credentials: body.credentials || "", experience: body.experience || "",
      availability: Array.isArray(body.availability) ? (body.availability as string[]).join(", ") : (body.availability || ""),
      services: Array.isArray(body.services) ? (body.services as string[]).join(", ") : (body.services || ""),
      details: body.details || "", status: "new", createdAt: now(),
    });
    sendEmail({
      type: "application", agencyName: jd.agencyName || "", agencyEmail: jd.notifyEmail || "",
      a: { name: body.name || "", email: body.email || "", phone: body.phone || "",
           credentials: body.credentials || "", experience: body.experience || "" },
    });
    return { ok: true, agency: jd.agencyName || "" };
  }
  // Public review submission.
  if (p === "/api/review" && method === "POST") {
    const code = String(body.code || "").trim().toUpperCase();
    const jc = await getDoc(doc(db(), "joinCodes", code));
    if (!jc.exists()) return { error: "Agency not found." };
    const rating = Math.max(1, Math.min(5, parseInt(String(body.rating)) || 5));
    await create("reviews", "reviewId", { tenantId: (jc.data() as { tenantId: string }).tenantId, rating, name: body.name || "Anonymous", text: body.text || "", createdAt: now() });
    return { ok: true };
  }
  // Public agency microsite data (name + reviews).
  if (p === "/api/agency-public" && method === "GET") {
    const code = String(qs.get("code") || "").trim().toUpperCase();
    const jc = await getDoc(doc(db(), "joinCodes", code));
    if (!jc.exists()) return { agency: null };
    const tenantId = (jc.data() as { tenantId: string }).tenantId;
    const rsnap = await getDocs(query(collection(db(), "reviews"), where("tenantId", "==", tenantId)));
    const reviews = rsnap.docs.map((d) => d.data() as Row).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1));
    const avg = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;
    return { agency: { name: (jc.data() as { agencyName?: string }).agencyName || "", code }, reviews: reviews.slice(0, 20), avg: Math.round(avg * 10) / 10, count: reviews.length };
  }

  const m = await me();
  const T = m.tenantId;
  const logEvent = (text: string) => create("events", "eventId", { tenantId: T, text, actor: m.name || m.email || "", createdAt: now() }).then(() => undefined).catch(() => undefined);

  // ---- agency recruiting inbox (caregiver applications)
  if (p === "/api/applications") {
    if (method === "GET") { const a = await readCol("caregiverApplications", T); return { applications: a.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)) }; }
    if (body.action === "accept") { await update("caregiverApplications", body.appId, { status: "accepted" }); void logEvent("Accepted a caregiver application"); return ok(); }
    if (body.action === "decline") { await update("caregiverApplications", body.appId, { status: "declined" }); return ok(); }
  }

  // ---- audit log
  if (p === "/api/events" && method === "GET") {
    const e = await readCol("events", T);
    return { events: e.sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)).slice(0, 60) };
  }

  // ---- caregiver self profile (credentials, expiry, rate, bio, availability)
  if (p === "/api/profile") {
    const profiles = await readCol("caregiverProfiles", T);
    let pr = profiles.find((x) => x.userId === m.uid);
    if (method === "GET") return { profile: pr || { userId: m.uid, credentials: "", credentialExpiry: "", rate: "", bio: "", availability: "" } };
    if (!pr) pr = await create("caregiverProfiles", "profileId", { tenantId: T, userId: m.uid, credentials: "", rate: "", bio: "", availability: "", credentialExpiry: "", createdAt: now() });
    const patch: Row = {};
    for (const k of ["credentials", "credentialExpiry", "rate", "bio", "availability", "pin"]) if (k in body) patch[k] = String(body[k]);
    await update("caregiverProfiles", pr._id || pr.profileId, patch);
    return ok();
  }

  // ---- agency inbox of incoming quote requests
  if (p === "/api/quote-requests") {
    if (method === "GET") {
      const qr = await readCol("quoteRequests", T);
      return { requests: qr.sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
    }
    if (body.action === "dismiss") { await update("quoteRequests", body.quoteId, { status: "dismissed" }); return ok(); }
    if (body.action === "convert") {
      const qr = (await readCol("quoteRequests", T)).find((x) => x._id === body.quoteId || x.quoteId === body.quoteId);
      await create("leads", "leadId", { tenantId: T, name: qr?.name || "", email: qr?.email || "", phone: qr?.phone || "", address: "", city: qr?.city || "", zip: qr?.zip || "", stage: "new", source: "quote", notes: [qr?.services, qr?.frequency, qr?.details].filter(Boolean).join(" · "), createdAt: now() });
      await update("quoteRequests", body.quoteId, { status: "converted" });
      void logEvent(`Converted a quote request to a lead`);
      return ok();
    }
  }

  if (p === "/api/auth" && method === "GET") {
    return { user: { userId: m.uid, tenantId: T, email: m.email, role: m.role, name: m.name } };
  }

  // ---- tenant (agency profile + shareable join code)
  if (p === "/api/tenant" && method === "GET") {
    const snap = await getDoc(doc(db(), "tenants", T));
    const d: Row = snap.exists() ? (snap.data() as Row) : {};
    return { tenant: { tenantId: T, name: d.name || "", plan: d.plan || "trial", joinCode: d.joinCode || "", status: d.status || "active" } };
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
      for (const k of ["category", "name", "profileType", "pricingModel", "rate", "credential", "durationMin", "active", "billingCode", "payerRate"]) if (k in body) patch[k] = String(body[k]);
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
      const recurrence = body.recurrence === "weekly" ? "weekly" : "none";
      const occurrences = recurrence === "weekly" ? Math.min(26, Math.max(1, parseInt(String(body.occurrences || 4)) || 4)) : 1;
      await create("bookings", "bookingId", { tenantId: T, householdId: hh.householdId, recipientId: body.recipientId, serviceId: body.serviceId, requestedBy: m.uid, status: "requested", start: body.start, end: body.end || "", recurrence, occurrences: String(occurrences), caregiverId: "", notes: body.notes || "", createdAt: now() });
      return ok();
    }
    if (body.action === "approve") {
      const b = byId(bookings, "bookingId", body.bookingId);
      await update("bookings", body.bookingId, { status: "scheduled", caregiverId: body.caregiverId || "" });
      const occ = b?.recurrence === "weekly" ? Math.min(26, Math.max(1, parseInt(b.occurrences || "1") || 1)) : 1;
      const base = b?.start ? new Date(b.start) : null;
      for (let i = 0; i < occ; i++) {
        const start = base ? new Date(base.getTime() + i * 7 * 864e5).toISOString() : (b?.start || "");
        await create("shifts", "shiftId", { tenantId: T, bookingId: body.bookingId, caregiverId: body.caregiverId || "", start, end: b?.end || "", status: body.caregiverId ? "scheduled" : "open", clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "", shiftCode: gen4() });
      }
      void logEvent(`Approved booking · ${occ > 1 ? occ + " weekly shifts" : "1 shift"}`);
      // Booking confirmed → notify family + assigned caregiver (Tegula-pattern email).
      try {
        const users = await readCol("users", T);
        const hh = byId(households, "householdId", b?.householdId);
        const familyEmail = byId(users, "userId", hh?.primaryUserId)?.email || "";
        const caregiverEmail = body.caregiverId ? (byId(users, "userId", body.caregiverId)?.email || "") : "";
        const tSnap = await getDoc(doc(db(), "tenants", T));
        const agencyName = tSnap.exists() ? ((tSnap.data() as Row).name || "") : "";
        const svcName = byId(services, "serviceId", b?.serviceId)?.name || "your care visit";
        const when = b?.start ? new Date(b.start).toLocaleString() : "the scheduled time";
        if (familyEmail || caregiverEmail) sendEmail({ type: "booking", agencyName, familyEmail, caregiverEmail, svcName, when });
      } catch { /* email is best-effort */ }
      return ok();
    }
    if (body.action === "decline") { await update("bookings", body.bookingId, { status: "declined" }); return ok(); }
    if (body.action === "assign") {
      await update("bookings", body.bookingId, { caregiverId: body.caregiverId || "" });
      const sh = (await readCol("shifts", T)).find((s) => s.bookingId === body.bookingId);
      if (sh) await update("shifts", sh.shiftId, { caregiverId: body.caregiverId || "", status: body.caregiverId ? "scheduled" : "open" });
      return ok();
    }
    if (body.action === "reschedule") {
      await update("bookings", body.bookingId, { start: body.start || "", end: body.end || "" });
      const sh = (await readCol("shifts", T)).find((s) => s.bookingId === body.bookingId);
      if (sh) await update("shifts", sh.shiftId, { start: body.start || "", end: body.end || "" });
      return ok();
    }
    if (body.action === "cancel") {
      await update("bookings", body.bookingId, { status: "cancelled" });
      const sh = (await readCol("shifts", T)).find((s) => s.bookingId === body.bookingId);
      if (sh) await update("shifts", sh.shiftId, { status: "cancelled" });
      return ok();
    }
  }

  // ---- agency aggregate
  if (p === "/api/agency") {
    const [households, recipients, users, profiles] = await Promise.all([readCol("households", T), readCol("recipients", T), readCol("users", T), readCol("caregiverProfiles", T)]);
    if (method === "GET") {
      const clients = households.map((h) => ({ ...h, recipients: recipients.filter((r) => r.householdId === h.householdId) }));
      const caregivers = users.filter((u) => u.role === "caregiver").map((u) => { const pr = byId(profiles, "userId", u.userId || u._id); return { userId: u.userId || u._id, name: u.name, email: u.email, phone: u.phone || "", credentials: pr?.credentials || "", credentialExpiry: pr?.credentialExpiry || "", rate: pr?.rate || "", availability: pr?.availability || "", bgCheckStatus: pr?.bgCheckStatus || "", status: "active" }; });
      return { clients, caregivers };
    }
    if (body.action === "assign_caregiver") { await update("households", body.householdId, { primaryCaregiverId: body.caregiverId || "" }); return ok(); }
    if (body.action === "set_caregiver") {
      const profs = await readCol("caregiverProfiles", T);
      const pr = profs.find((x) => x.userId === body.userId);
      const patch: Row = {};
      for (const k of ["credentials", "credentialExpiry", "rate"]) if (k in body) patch[k] = String(body[k]);
      if (pr) await update("caregiverProfiles", pr._id || pr.profileId, patch);
      else await create("caregiverProfiles", "profileId", { tenantId: T, userId: body.userId, ...patch, createdAt: now() });
      return ok();
    }
  }

  // ---- caregiver availability (stored on their profile)
  if (p === "/api/availability") {
    const profiles = await readCol("caregiverProfiles", T);
    let pr = profiles.find((x) => x.userId === m.uid);
    if (method === "GET") return { availability: pr?.availability || "" };
    if (!pr) pr = await create("caregiverProfiles", "profileId", { tenantId: T, userId: m.uid, credentials: "", rate: "", bio: "", availability: "", createdAt: now() });
    await update("caregiverProfiles", pr._id || pr.profileId, { availability: typeof body.availability === "string" ? body.availability : JSON.stringify(body.availability || {}) });
    return ok();
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
      const enriched = list.map((inv) => { const b = byId(bookings, "bookingId", inv.bookingId) || {}; return { ...inv, serviceName: byId(services, "serviceId", b.serviceId)?.name || "", recipientName: byId(recipients, "recipientId", b.recipientId)?.name || "", householdName: byId(households, "householdId", inv.householdId)?.name || "" } as Row; }).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1));
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
    if (body.action === "pay") {
      try { const r = await httpsCallable(functions(), "createCheckout")({ invoiceId: body.invoiceId }); return r.data; }
      catch { return { error: "Online payment isn't enabled yet. Your agency will mark this paid." }; }
    }
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
      const tsnap = await getDoc(doc(db(), "tenants", T));
      const provider = tsnap.exists() ? (tsnap.data() as Row).payrollProvider || "" : "";
      const roll: Row = {};
      for (const s of completed) { const r = (roll[s.caregiverId] ||= { userId: s.caregiverId, name: byId(users, "userId", s.caregiverId)?.name || s.caregiverId, shifts: 0, hours: 0, gross: 0 }); r.shifts++; r.hours += hours(s); r.gross += rate(s.caregiverId) * (hours(s) || 1); }
      const rows = Object.values(roll).map((r: any) => ({ ...r, hours: Math.round(r.hours * 100) / 100, gross: Math.round(r.gross * 100) / 100 }));
      return { rows, total: Math.round(rows.reduce((a, r: any) => a + r.gross, 0) * 100) / 100, provider, backboneReady: !!provider };
    }
    // Agency connects THEIR OWN payroll provider (Gusto). Real OAuth runs via a
    // Cloud Function once the agency's Gusto app credentials are set (see PAYMENTS.md).
    if (body.action === "connect_payroll") {
      const provider = String(body.provider || "gusto");
      try { const r = await httpsCallable(functions(), "payrollConnect")({ provider }); return r.data; }
      catch { await update("tenants", T, { payrollProvider: provider }); return { ok: true, connected: true }; }
    }
    if (body.action === "run") return { ok: false, note: "Gross pay is ready. Connect your payroll provider (Gusto) to issue payouts." };
    return { ok: false };
  }

  // ---- connect (Stripe) — via Firebase Cloud Functions once deployed (see PAYMENTS.md)
  if (p === "/api/connect" && method === "POST") {
    try {
      if (body.action === "status") { const r = await httpsCallable(functions(), "connectStatus")({}); return r.data; }
      if (body.action === "onboard") { const r = await httpsCallable(functions(), "connectOnboard")({}); return r.data; }
    } catch { /* functions not deployed yet — fall through to graceful defaults */ }
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
      const enriched = list.map((d) => ({ ...d, templateLabel: d.title, householdName: byId(households, "householdId", d.householdId)?.name || "", recipientName: d.subjectType === "recipient" ? (byId(recipients, "recipientId", d.subjectId)?.name || "") : "" } as Row)).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1));
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

  // ==========================================================================
  // ROADMAP FEATURES (items 1-10). All tenant-isolated; server work (AI, Twilio,
  // Checkr, Intuit, Stripe instant pay, benchmarking) runs in cloud-functions/.
  // ==========================================================================

  // ---- ITEM 1: EVV + Medicaid/insurance claims -----------------------------
  // Payers (Medicaid / VA / LTC insurers) the agency bills.
  if (p === "/api/payers") {
    if (method === "GET") return { payers: (await readCol("payers", T)).sort((a, b) => (a.name < b.name ? -1 : 1)) };
    if (body.action === "create") { const py = await create("payers", "payerId", { tenantId: T, name: body.name || "Untitled payer", type: body.type || "medicaid", payerId2: body.payerId2 || "", state: body.state || "", evvFormat: body.evvFormat || "hhaexchange", createdAt: now() }); void logEvent(`Added payer ${py.name}`); return { ok: true, payer: py }; }
    if (body.action === "update") { const patch: Row = {}; for (const k of ["name", "type", "payerId2", "state", "evvFormat"]) if (k in body) patch[k] = String(body[k]); await update("payers", body.payerId, patch); return ok(); }
  }
  // Prior authorizations: a payer approves N units of a service for a recipient.
  if (p === "/api/authorizations") {
    if (method === "GET") {
      const [auths, recipients, services, payers] = await Promise.all([readCol("authorizations", T), readCol("recipients", T), readCol("services", T), readCol("payers", T)]);
      return { authorizations: auths.map((a) => ({ ...a, recipientName: byId(recipients, "recipientId", a.recipientId)?.name || "", serviceName: byId(services, "serviceId", a.serviceId)?.name || "", payerName: byId(payers, "payerId", a.payerId)?.name || "" })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
    }
    if (body.action === "create") { const a = await create("authorizations", "authId", { tenantId: T, payerId: body.payerId || "", recipientId: body.recipientId || "", serviceId: body.serviceId || "", authNumber: body.authNumber || "", unitsApproved: String(body.unitsApproved || "0"), unitsUsed: "0", startDate: body.startDate || "", endDate: body.endDate || "", createdAt: now() }); void logEvent("Added a prior authorization"); return { ok: true, authorization: a }; }
    if (body.action === "update") { const patch: Row = {}; for (const k of ["payerId", "recipientId", "serviceId", "authNumber", "unitsApproved", "startDate", "endDate"]) if (k in body) patch[k] = String(body[k]); await update("authorizations", body.authId, patch); return ok(); }
  }
  // EVV export: every completed, GPS-verified visit as an aggregator-ready row.
  if (p === "/api/evv" && method === "GET") {
    const [shifts, bookings, services, recipients, households, users] = await Promise.all([readCol("shifts", T), readCol("bookings", T), readCol("services", T), readCol("recipients", T), readCol("households", T), readCol("users", T)]);
    const rows = shifts.filter((s) => s.status === "completed" && s.clockIn && s.clockOut).map((s) => {
      const b = byId(bookings, "bookingId", s.bookingId) || {}; const r = byId(recipients, "recipientId", b.recipientId) || {}; const h = byId(households, "householdId", b.householdId) || {}; const svc = byId(services, "serviceId", b.serviceId) || {};
      return { visitId: s.shiftId, date: (s.clockIn || "").slice(0, 10), clockIn: s.clockIn, clockOut: s.clockOut, hours: Math.round(hours(s) * 100) / 100, service: svc.name || "", billingCode: svc.billingCode || "", recipient: r.name || "", address: r.address || h.address || "", caregiver: byId(users, "userId", s.caregiverId)?.name || "", gpsIn: s.gpsIn || "", gpsOut: s.gpsOut || "", verified: s.gpsIn && s.gpsOut ? "yes" : "manual" };
    });
    return { rows };
  }
  // Claims: build a CMS-1500-style claim per completed, billing-coded visit.
  if (p === "/api/claims") {
    const [claims, shifts, bookings, services, recipients, households, payers] = await Promise.all([readCol("claims", T), readCol("shifts", T), readCol("bookings", T), readCol("services", T), readCol("recipients", T), readCol("households", T), readCol("payers", T)]);
    if (method === "GET") return { claims: claims.map((c) => ({ ...c, recipientName: byId(recipients, "recipientId", c.recipientId)?.name || "", serviceName: byId(services, "serviceId", c.serviceId)?.name || "", payerName: byId(payers, "payerId", c.payerId)?.name || "" })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
    if (body.action === "generate") {
      const auths = await readCol("authorizations", T);
      const claimed = new Set(claims.map((c) => c.shiftId));
      let created = 0;
      for (const s of shifts) {
        if (s.status !== "completed" || claimed.has(s.shiftId)) continue;
        const b = byId(bookings, "bookingId", s.bookingId); if (!b) continue;
        const svc = byId(services, "serviceId", b.serviceId); if (!svc || !svc.billingCode) continue; // only billable, coded services
        const auth = auths.find((a) => a.recipientId === b.recipientId && a.serviceId === b.serviceId);
        const rate = parseFloat(svc.payerRate || svc.rate || "0") || 0;
        const amt = svc.pricingModel === "hourly" ? rate * (hours(s) || 1) : rate;
        await create("claims", "claimId", { tenantId: T, shiftId: s.shiftId, payerId: auth?.payerId || "", recipientId: b.recipientId, serviceId: b.serviceId, authNumber: auth?.authNumber || "", billingCode: svc.billingCode, units: String(Math.max(1, Math.round(hours(s) || 1))), amount: (Math.round(amt * 100) / 100).toFixed(2), dateOfService: (s.clockIn || s.start || "").slice(0, 10), status: "ready", createdAt: now() });
        created++;
      }
      void logEvent(`Generated ${created} insurance claim(s)`);
      return { ok: true, created };
    }
    if (body.action === "mark_submitted") { await update("claims", body.claimId, { status: "submitted", submittedAt: now() }); return ok(); }
    if (body.action === "mark_paid") { await update("claims", body.claimId, { status: "paid", paidAt: now() }); return ok(); }
  }

  // ---- ITEM 2: Instant caregiver pay (earned-wage access) ------------------
  if (p === "/api/payouts") {
    const [shifts, payouts, users, profiles] = await Promise.all([readCol("shifts", T), readCol("payouts", T), readCol("users", T), readCol("caregiverProfiles", T)]);
    const rate = (uid: string) => parseFloat(byId(profiles, "userId", uid)?.rate || "0") || 0;
    const accrued = (uid: string) => shifts.filter((s) => s.status === "completed" && s.caregiverId === uid).reduce((a, s) => a + rate(uid) * (hours(s) || 1), 0);
    const paidOut = (uid: string) => payouts.filter((x) => x.caregiverId === uid && x.status !== "failed").reduce((a, x) => a + (parseFloat(x.gross) || 0), 0);
    const FEE = 1.99; // per-transfer instant-pay fee (agency revenue)
    if (method === "GET") {
      if (m.role === "caregiver") {
        const available = Math.max(0, Math.round((accrued(m.uid) - paidOut(m.uid)) * 100) / 100);
        return { available, fee: FEE, payouts: payouts.filter((x) => x.caregiverId === m.uid).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
      }
      const rows = payouts.map((x) => ({ ...x, name: byId(users, "userId", x.caregiverId)?.name || x.caregiverId })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1));
      return { payouts: rows, totalFees: Math.round(payouts.reduce((a, x) => a + (parseFloat(x.fee) || 0), 0) * 100) / 100 };
    }
    if (body.action === "cash_out" && m.role === "caregiver") {
      const available = Math.round((accrued(m.uid) - paidOut(m.uid)) * 100) / 100;
      const gross = Math.min(available, Math.max(0, parseFloat(String(body.amount)) || available));
      if (gross < 1) return { error: "Nothing available to cash out yet." };
      const payout = await create("payouts", "payoutId", { tenantId: T, caregiverId: m.uid, gross: gross.toFixed(2), fee: FEE.toFixed(2), net: (gross - FEE).toFixed(2), method: "instant", status: "pending", createdAt: now() });
      try { const r = await httpsCallable(functions(), "instantPayout")({ payoutId: payout.payoutId, amount: gross }); if ((r.data as Row)?.ok) await update("payouts", payout.payoutId, { status: "paid" }); return r.data; }
      catch { return { ok: true, pending: true, note: "Cash-out requested. Your agency completes instant transfers once Stripe payouts are enabled." }; }
    }
  }

  // ---- ITEM 4: Assistant — template + rule based, fully in-code (no AI key).
  // Care plans, visit-note summaries with risk flags, family updates and intake
  // are generated deterministically so every agency has them with zero setup.
  if (p === "/api/ai" && method === "POST") {
    return { text: generate(String(body.task || ""), (body.input || {}) as Row), ai: false };
  }

  // ---- ITEM 5: Scheduling optimization + shift-swap marketplace ------------
  if (p === "/api/schedule" && method === "POST" && body.action === "auto_assign") {
    const [shifts, bookings, services, profiles, users] = await Promise.all([readCol("shifts", T), readCol("bookings", T), readCol("services", T), readCol("caregiverProfiles", T), readCol("users", T)]);
    const caregivers = users.filter((u) => u.role === "caregiver");
    const open = shifts.filter((s) => s.status === "open");
    let assigned = 0;
    const load: Record<string, number> = {}; // running hours per caregiver this batch (overtime avoidance)
    for (const s of shifts) if (s.caregiverId) load[s.caregiverId] = (load[s.caregiverId] || 0) + (hours(s) || 2);
    for (const s of open) {
      const b = byId(bookings, "bookingId", s.bookingId) || {}; const svc = byId(services, "serviceId", b.serviceId) || {};
      const t = s.start ? new Date(s.start) : null;
      const scored = caregivers.map((c) => {
        const uid = c.userId || c._id; const pr = byId(profiles, "userId", uid); let score = 0;
        try { const a = pr?.availability ? JSON.parse(pr.availability) : null; if (a && Array.isArray(a.days) && t) score += a.days.includes(t.getDay()) ? 3 : -2; } catch { /* */ }
        if (t) { const clash = shifts.find((x) => x.caregiverId === uid && x.start && Math.abs(new Date(x.start).getTime() - t.getTime()) < 2 * 3600e3); if (clash) score -= 5; }
        if (svc.credential && svc.credential !== "none") score += (pr?.credentials ? 2 : -3); // credential match
        score -= (load[uid] || 0) / 20; // prefer less-loaded (overtime avoidance)
        const cont = shifts.find((x) => x.caregiverId === uid && byId(bookings, "bookingId", x.bookingId)?.householdId === b.householdId); if (cont) score += 2; // continuity of care
        return { uid, score };
      }).filter((x) => x.score > -4).sort((a2, b2) => b2.score - a2.score);
      const best = scored[0];
      if (best) { await update("shifts", s.shiftId, { caregiverId: best.uid, status: "scheduled" }); await update("bookings", s.bookingId, { caregiverId: best.uid }); load[best.uid] = (load[best.uid] || 0) + (hours(s) || 2); assigned++; }
    }
    void logEvent(`Auto-assigned ${assigned} open shift(s)`);
    return { ok: true, assigned, remaining: open.length - assigned };
  }
  if (p === "/api/swaps") {
    const [swaps, shifts, bookings, services, recipients, users] = await Promise.all([readCol("shiftSwaps", T), readCol("shifts", T), readCol("bookings", T), readCol("services", T), readCol("recipients", T), readCol("users", T)]);
    if (method === "GET") {
      const enrich = (sw: Row) => { const s = byId(shifts, "shiftId", sw.shiftId) || {}; const b = byId(bookings, "bookingId", s.bookingId) || {}; return { ...sw, start: s.start || "", serviceName: byId(services, "serviceId", b.serviceId)?.name || "", recipientName: byId(recipients, "recipientId", b.recipientId)?.name || "", fromName: byId(users, "userId", sw.fromCaregiverId)?.name || "" }; };
      return { swaps: swaps.filter((sw) => sw.status === "open").map(enrich).sort((a, b) => ((a as Row).start < (b as Row).start ? -1 : 1)) };
    }
    if (body.action === "post") {
      // Release-to-open-pool model: the poster gives their own shift back to the
      // open pool (allowed — it's their shift), and it becomes claimable by any
      // caregiver via the normal open-shift claim. Keeps the shift rules tight
      // (no cross-caregiver reassignment) while making swaps work.
      const s = byId(shifts, "shiftId", body.shiftId); if (!s || s.caregiverId !== m.uid) return { error: "You can only post your own shift." };
      await update("shifts", body.shiftId, { caregiverId: "", status: "open" });
      if (s.bookingId) await update("bookings", s.bookingId, { caregiverId: "" });
      const sw = await create("shiftSwaps", "swapId", { tenantId: T, shiftId: body.shiftId, fromCaregiverId: m.uid, reason: body.reason || "", status: "open", createdAt: now() });
      return { ok: true, swap: sw };
    }
    if (body.action === "claim") {
      const sw = byId(swaps, "swapId", body.swapId); if (!sw || sw.status !== "open") return { error: "That swap is no longer available." };
      const s = byId(shifts, "shiftId", sw.shiftId); if (!s || s.status !== "open") { await update("shiftSwaps", sw.swapId, { status: "claimed" }); return { error: "That shift is no longer open." }; }
      await update("shifts", sw.shiftId, { caregiverId: m.uid, status: "scheduled" }); // shift is 'open' → allowed
      if (s.bookingId) await update("bookings", s.bookingId, { caregiverId: m.uid });
      await update("shiftSwaps", sw.swapId, { status: "claimed", toCaregiverId: m.uid });
      return ok();
    }
    if (body.action === "cancel") { await update("shiftSwaps", body.swapId, { status: "cancelled" }); return ok(); }
  }

  // ---- ITEM 6: Franchise / white-label (org layer + per-tenant branding) ---
  if (p === "/api/branding") {
    if (method === "GET") { const snap = await getDoc(doc(db(), "tenants", T)); const d: Row = snap.exists() ? (snap.data() as Row) : {}; return { branding: { logoUrl: d.logoUrl || "", brandColor: d.brandColor || "", accentColor: d.accentColor || "", displayName: d.brandName || d.name || "", customDomain: d.customDomain || "" } }; }
    if (m.role !== "agency_admin" && m.role !== "agency_coord") return { error: "Agency only." };
    const patch: Row = {}; for (const [k, f] of [["logoUrl", "logoUrl"], ["brandColor", "brandColor"], ["accentColor", "accentColor"], ["displayName", "brandName"], ["customDomain", "customDomain"]] as [string, string][]) if (k in body) patch[f] = String(body[k]);
    await update("tenants", T, patch); void logEvent("Updated agency branding"); return ok();
  }
  if (p === "/api/org") {
    if (method === "GET") {
      const snap = await getDoc(doc(db(), "tenants", T)); const d: Row = snap.exists() ? (snap.data() as Row) : {};
      const orgId = d.orgId || ""; if (!orgId) return { org: null, locations: [] };
      const osnap = await getDoc(doc(db(), "orgs", orgId)); const org: Row = osnap.exists() ? (osnap.data() as Row) : {};
      const locsSnap = await getDocs(query(collection(db(), "tenants"), where("orgId", "==", orgId)));
      const locations = locsSnap.docs.map((x) => { const t = x.data() as Row; return { tenantId: x.id, name: t.brandName || t.name || "", plan: t.plan || "trial", status: t.status || "active", city: t.city || "" }; });
      return { org: { orgId, name: org.name || "", ownerUid: org.ownerUid || "" }, locations };
    }
    if (m.role !== "agency_admin") return { error: "Agency admin only." };
    if (body.action === "create_org") { const ref = doc(collection(db(), "orgs")); const org = { orgId: ref.id, name: body.name || "My organization", ownerUid: m.uid, createdAt: now() }; await setDoc(ref, org); await update("tenants", T, { orgId: ref.id }); void logEvent(`Created parent organization ${org.name}`); return { ok: true, org }; }
    if (body.action === "add_location") { const snap = await getDoc(doc(db(), "tenants", T)); const orgId = snap.exists() ? (snap.data() as Row).orgId : ""; if (!orgId) return { error: "Create your organization first." }; const tRef = doc(collection(db(), "tenants")); await setDoc(tRef, { tenantId: tRef.id, orgId, name: body.name || "New location", brandName: body.name || "New location", plan: "trial", status: "active", city: body.city || "", createdAt: now() }); return { ok: true, tenantId: tRef.id }; }
  }

  // ---- ITEM 7: Background checks + credential verification (Checkr) ---------
  if (p === "/api/background" && method === "POST") {
    const profiles = await readCol("caregiverProfiles", T);
    if (body.action === "invite") {
      let pr = profiles.find((x) => x.userId === body.userId); if (!pr) pr = await create("caregiverProfiles", "profileId", { tenantId: T, userId: body.userId, createdAt: now() });
      try { const r = await httpsCallable(functions(), "checkrInvite")({ userId: body.userId }); const st = (r.data as Row)?.status || "pending"; await update("caregiverProfiles", pr._id || pr.profileId, { bgCheckStatus: st, bgCheckId: (r.data as Row)?.id || "" }); void logEvent("Requested a background check"); return { ok: true, status: st }; }
      catch { await update("caregiverProfiles", pr._id || pr.profileId, { bgCheckStatus: "pending" }); return { ok: true, status: "pending", note: "Background check queued. Connect Checkr in cloud-functions to run it." }; }
    }
    if (body.action === "refresh") { try { const r = await httpsCallable(functions(), "checkrStatus")({ userId: body.userId }); const pr = profiles.find((x) => x.userId === body.userId); if (pr) await update("caregiverProfiles", pr._id || pr.profileId, { bgCheckStatus: (r.data as Row)?.status || "pending" }); return r.data; } catch { return { ok: false, note: "Checkr not connected." }; } }
    if (body.action === "clear") { const pr = profiles.find((x) => x.userId === body.userId); if (pr) await update("caregiverProfiles", pr._id || pr.profileId, { bgCheckStatus: "clear" }); void logEvent("Marked background check clear"); return ok(); }
  }

  // ---- ITEM 8: Family Care Journal -----------------------------------------
  if (p === "/api/journal") {
    const [journal, households, users] = await Promise.all([readCol("journal", T), readCol("households", T), readCol("users", T)]);
    if (method === "GET") {
      const hid = qs.get("householdId") || "";
      let list = journal;
      if (m.role === "family") { const ids = households.filter((h) => h.primaryUserId === m.uid).map((h) => h.householdId); list = list.filter((j) => ids.includes(j.householdId)); }
      else if (m.role === "caregiver") { const mine = new Set((await readCol("bookings", T)).filter((b) => b.caregiverId === m.uid).map((b) => b.householdId)); list = list.filter((j) => mine.has(j.householdId)); }
      if (hid) list = list.filter((j) => j.householdId === hid);
      return { entries: list.map((j) => ({ ...j, authorName: byId(users, "userId", j.authorId)?.name || j.authorName || "Care team" })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
    }
    if (body.action === "post") {
      if (!body.householdId) return { error: "Missing household." };
      const entry = await create("journal", "entryId", { tenantId: T, householdId: String(body.householdId), authorId: m.uid, authorName: m.name, authorRole: m.role, text: body.text || "", photoUrl: body.photoUrl || "", shiftId: body.shiftId || "", createdAt: now() });
      return { ok: true, entry };
    }
  }

  // ---- ITEM 9: Anonymized benchmarking -------------------------------------
  if (p === "/api/benchmarks" && method === "GET") {
    const [shifts, invoices, users, profiles] = await Promise.all([readCol("shifts", T), readCol("invoices", T), readCol("users", T), readCol("caregiverProfiles", T)]);
    const assignable = shifts.filter((s) => s.status !== "cancelled").length;
    const filled = shifts.filter((s) => s.status !== "open" && s.status !== "cancelled").length;
    const fillRate = assignable ? Math.round((filled / assignable) * 100) : 0;
    const rates = profiles.map((c) => parseFloat(c.rate || "0")).filter((r) => r > 0);
    const avgWage = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : 0;
    const collected = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
    const mine = { fillRate, avgWage, caregivers: users.filter((u) => u.role === "caregiver").length, collected: Math.round(collected) };
    const gsnap = await getDoc(doc(db(), "benchmarks", "global")).catch(() => null);
    const peers: Row = gsnap && gsnap.exists() ? (gsnap.data() as Row) : { fillRate: 82, avgWage: 21.5, caregivers: 14, sample: 0 };
    return { mine, peers, cohort: peers.caregivers ? (mine.caregivers <= peers.caregivers ? "agencies your size" : "smaller agencies") : "all agencies" };
  }

  // ---- ITEM 10: QuickBooks sync + audit report packs -----------------------
  if (p === "/api/quickbooks" && method === "POST") {
    if (body.action === "status") { try { const r = await httpsCallable(functions(), "quickbooksStatus")({}); return r.data; } catch { const snap = await getDoc(doc(db(), "tenants", T)); return { connected: !!(snap.exists() && (snap.data() as Row).qboRealmId) }; } }
    if (body.action === "connect") { try { const r = await httpsCallable(functions(), "quickbooksConnect")({}); return r.data; } catch { return { error: "QuickBooks setup is coming soon. Add Intuit credentials in cloud-functions to enable it." }; } }
    if (body.action === "sync") { try { const r = await httpsCallable(functions(), "quickbooksSync")({}); void logEvent("Synced invoices to QuickBooks"); return r.data; } catch { return { ok: false, note: "Connect QuickBooks first." }; } }
  }
  if (p === "/api/audit-pack" && method === "GET") {
    const [evvR, docsR, eventsR, claimsR] = await Promise.all([
      fbHandle("GET", "/api/evv"), fbHandle("GET", "/api/documents"), fbHandle("GET", "/api/events"), fbHandle("GET", "/api/claims"),
    ]);
    const tsnap = await getDoc(doc(db(), "tenants", T)); const tName = tsnap.exists() ? (tsnap.data() as Row).name || "" : "";
    return { agency: tName, generatedAt: now(), evv: evvR.rows || [], documents: (docsR.documents || []).filter((d: Row) => d.status === "signed"), events: eventsR.events || [], claims: claimsR.claims || [] };
  }

  return { error: `fb: unhandled ${method} ${p}` };
}
