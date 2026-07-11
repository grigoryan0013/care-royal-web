// DEMO MODE — runs the entire app on seeded sample data, no backend/credentials.
// Activated by logging in as grigoryan / 201816. One identity can switch between
// the Agency, Family, and Caregiver portals to test every function. All actions
// mutate a localStorage DB so changes persist and show across portals.
import type { Role, SessionUser } from "./session";

const FLAG = "cr_demo";           // demo backend (route /api calls to the mock)
const SESSION = "cr_demo_session"; // logged into a demo portal
const ROLE = "cr_demo_role";
const DB = "cr_demo_db";
const now = () => new Date().toISOString();
const inHours = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
const agoHours = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

// Demo backend is on for the static review build (NEXT_PUBLIC_DEMO=1) or once a
// user has entered the demo. It only routes data; it does NOT log anyone in.
export function isDemoBackend(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEMO === "1") return true;
  return typeof window !== "undefined" && localStorage.getItem(FLAG) === "1";
}
// A demo portal session (after the grigoryan login).
export function hasDemoSession(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(SESSION) === "1";
}
export function isDemo(): boolean { return isDemoBackend(); }

export function enableDemo() {
  localStorage.setItem(FLAG, "1");
  localStorage.setItem(SESSION, "1");
  localStorage.setItem(ROLE, "agency_admin");
  seedIfEmpty();
}
export function disableDemo() {
  localStorage.removeItem(SESSION);
  localStorage.removeItem(ROLE);
}
export function getDemoRole(): Role {
  return (typeof window !== "undefined" && (localStorage.getItem(ROLE) as Role)) || "agency_admin";
}
export function setDemoRole(r: Role) {
  localStorage.setItem(ROLE, r);
}

const IDS = { admin: "u_admin", family: "u_family", cg: "u_cg", tenant: "t_demo" };

export function demoUser(role: Role): SessionUser {
  if (role === "family") return { userId: IDS.family, tenantId: IDS.tenant, email: "family@demo", role, name: "Jordan Miller" };
  if (role === "caregiver") return { userId: IDS.cg, tenantId: IDS.tenant, email: "ana@demo", role, name: "Ana Reyes" };
  return { userId: IDS.admin, tenantId: IDS.tenant, email: "grigoryan", role: "agency_admin", name: "Owner" };
}

// ---- seed --------------------------------------------------------------
type Row = Record<string, string>;
interface Db {
  Users: Row[]; Households: Row[]; Recipients: Row[]; Services: Row[];
  CaregiverProfiles: Row[]; Bookings: Row[]; Shifts: Row[]; Invoices: Row[];
  Documents: Row[]; Leads: Row[]; Waitlist: Row[]; Tenant: Row;
}

function seedIfEmpty() {
  if (localStorage.getItem(DB)) return;
  resetDemo();
}

export function resetDemo() {
  const svc = (id: string, category: string, name: string, profileType: string, pricingModel: string, rate: string, credential: string) =>
    ({ serviceId: id, tenantId: IDS.tenant, category, name, profileType, pricingModel, rate, credential, durationMin: "120", active: "true" });

  const services = [
    svc("s1", "Personal & senior care", "Bathing, dressing & grooming", "person", "hourly", "35", "caregiver"),
    svc("s2", "Personal & senior care", "Medication reminders", "person", "visit", "40", "caregiver"),
    svc("s3", "Companion & non-medical", "Companionship", "person", "hourly", "30", "none"),
    svc("s4", "Companion & non-medical", "Meal preparation", "person", "hourly", "30", "none"),
    svc("s5", "Skilled home health", "Skilled nursing visit", "person", "visit", "90", "lvn_rn"),
    svc("s6", "Specialized condition care", "Dementia & Alzheimer's care", "person", "hourly", "38", "caregiver"),
    svc("s7", "Child care", "Babysitting", "person", "hourly", "25", "none"),
    svc("s8", "Pet care", "Dog walking", "pet", "walk", "22", "none"),
    svc("s9", "Pet care", "Pet sitting (visit)", "pet", "visit", "28", "none"),
    svc("s10", "Household & home services", "Recurring housekeeping", "home", "hourly", "35", "none"),
    svc("s11", "Household & home services", "Deep cleaning", "home", "flat", "180", "none"),
    svc("s12", "Transportation", "Medical appointment transport", "person", "trip", "45", "none"),
    svc("s13", "Respite & family support", "Respite care", "person", "hourly", "34", "caregiver"),
    svc("s14", "Wellness add-ons", "In-home haircut / salon", "person", "visit", "50", "none"),
  ];

  const db: Db = {
    Tenant: { tenantId: IDS.tenant, name: "Care Royal", slug: "care-royal", plan: "standard", status: "active", stripeAccountId: "", createdAt: now() },
    Users: [
      { userId: IDS.admin, tenantId: IDS.tenant, email: "grigoryan", role: "agency_admin", name: "Owner", phone: "", status: "active", createdAt: now() },
      { userId: IDS.family, tenantId: IDS.tenant, email: "family@demo", role: "family", name: "Jordan Miller", phone: "310-555-0142", status: "active", createdAt: now() },
      { userId: IDS.cg, tenantId: IDS.tenant, email: "ana@demo", role: "caregiver", name: "Ana Reyes", phone: "213-555-0199", status: "active", createdAt: now() },
    ],
    CaregiverProfiles: [{ userId: IDS.cg, tenantId: IDS.tenant, credentials: "CNA", rate: "28", bio: "", status: "active" }],
    Households: [{ householdId: "hh1", tenantId: IDS.tenant, primaryUserId: IDS.family, name: "The Miller Family", address: "482 Maple Ave", city: "Los Angeles", zip: "90026", createdAt: now() }],
    Recipients: [
      { recipientId: "r1", tenantId: IDS.tenant, householdId: "hh1", name: "Margaret Miller", type: "person", dob: "1948-03-11", address: "482 Maple Ave", conditions: "Diabetes, limited mobility", notes: "Prefers morning visits", photoUrl: "", createdAt: now() },
      { recipientId: "r2", tenantId: IDS.tenant, householdId: "hh1", name: "Rex", type: "pet", dob: "", address: "482 Maple Ave", conditions: "Golden Retriever, hip medication", notes: "", photoUrl: "", createdAt: now() },
      { recipientId: "r3", tenantId: IDS.tenant, householdId: "hh1", name: "Miller Residence", type: "home", dob: "", address: "482 Maple Ave", conditions: "", notes: "Key in lockbox", photoUrl: "", createdAt: now() },
    ],
    Services: services,
    Bookings: [
      { bookingId: "b1", tenantId: IDS.tenant, householdId: "hh1", recipientId: "r1", serviceId: "s1", requestedBy: IDS.family, status: "requested", start: inHours(30), end: "", recurrence: "none", caregiverId: "", notes: "First visit — please call ahead", createdAt: now() },
      { bookingId: "b2", tenantId: IDS.tenant, householdId: "hh1", recipientId: "r2", serviceId: "s8", requestedBy: IDS.family, status: "scheduled", start: inHours(3), end: "", recurrence: "none", caregiverId: IDS.cg, notes: "", createdAt: now() },
      { bookingId: "b3", tenantId: IDS.tenant, householdId: "hh1", recipientId: "r1", serviceId: "s3", requestedBy: IDS.family, status: "completed", start: agoHours(26), end: "", recurrence: "none", caregiverId: IDS.cg, notes: "", createdAt: now() },
      { bookingId: "b4", tenantId: IDS.tenant, householdId: "hh1", recipientId: "r3", serviceId: "s10", requestedBy: IDS.family, status: "scheduled", start: inHours(48), end: "", recurrence: "none", caregiverId: "", notes: "", createdAt: now() },
    ],
    Shifts: [
      { shiftId: "sh2", tenantId: IDS.tenant, bookingId: "b2", caregiverId: IDS.cg, start: inHours(3), end: "", status: "scheduled", clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "" },
      { shiftId: "sh3", tenantId: IDS.tenant, bookingId: "b3", caregiverId: IDS.cg, start: agoHours(26), end: "", status: "completed", clockIn: agoHours(26), clockOut: agoHours(24), gpsIn: "34.07,-118.26", gpsOut: "34.07,-118.26", notes: "Prepared lunch, medication taken, good spirits." },
      { shiftId: "shO", tenantId: IDS.tenant, bookingId: "b4", caregiverId: "", start: inHours(48), end: "", status: "open", clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "" },
    ],
    Invoices: [
      { invoiceId: "inv1", tenantId: IDS.tenant, householdId: "hh1", bookingId: "b3", amount: "60.00", status: "unpaid", stripeId: "", createdAt: agoHours(23) },
    ],
    Documents: [
      { docId: "doc1", tenantId: IDS.tenant, subjectType: "household", subjectId: "hh1", template: "care_plan", driveFileId: "", status: "unsigned", signedBy: "", signedAt: "", title: "Care Plan", content: carePlanText(), signature: "", householdId: "hh1", createdAt: now() },
      { docId: "doc2", tenantId: IDS.tenant, subjectType: "caregiver", subjectId: IDS.cg, template: "hipaa", driveFileId: "", status: "unsigned", signedBy: "", signedAt: "", title: "HIPAA Acknowledgment", content: "HIPAA ACKNOWLEDGMENT\n\nI acknowledge Care Royal may use health information as necessary to coordinate and deliver care.", signature: "", householdId: "", createdAt: now() },
    ],
    Leads: seedLeads(),
    Waitlist: [],
  };
  localStorage.setItem(DB, JSON.stringify(db));
}

function carePlanText() {
  return ["CARE PLAN", "", "Client household: The Miller Family", "Care recipient: Margaret Miller", "",
    "Care goals: daily companionship, medication reminders, and light meal preparation. Assist with mobility and monitor blood sugar per family guidance.",
    "", "By signing, the Client acknowledges and approves this care plan."].join("\n");
}

function seedLeads(): Row[] {
  const data: [string, string, string, string, string, string][] = [
    ["Patricia Nguyen", "patricia.n@example.com", "310-555-0111", "Santa Monica", "90401", "new"],
    ["David Okafor", "d.okafor@example.com", "323-555-0122", "Pasadena", "91101", "new"],
    ["Elena Vasquez", "elena.v@example.com", "213-555-0133", "Los Angeles", "90015", "contacted"],
    ["Robert Chen", "rchen@example.com", "818-555-0144", "Glendale", "91203", "contacted"],
    ["Aisha Mohammed", "aisha.m@example.com", "424-555-0155", "Inglewood", "90301", "consultation"],
    ["Frank DiMaggio", "frankd@example.com", "310-555-0166", "Torrance", "90501", "consultation"],
    ["Grace Park", "grace.park@example.com", "626-555-0177", "Arcadia", "91006", "client"],
    ["Samuel Adeyemi", "sam.a@example.com", "213-555-0188", "Los Angeles", "90012", "lost"],
  ];
  return data.map(([name, email, phone, city, zip, stage], i) => ({
    leadId: `lead${i}`, tenantId: IDS.tenant, name, email, phone, address: "", city, zip, stage, source: "seed", notes: "", createdAt: now(),
  }));
}

// ---- db access ---------------------------------------------------------
function read(): Db { seedIfEmpty(); return JSON.parse(localStorage.getItem(DB) as string); }
function write(db: Db) { localStorage.setItem(DB, JSON.stringify(db)); }
function id(prefix: string) { return `${prefix}_${Math.random().toString(16).slice(2, 10)}`; }
function ok() { return { ok: true }; }

// ---- the mock API ------------------------------------------------------
export async function demoHandle(method: string, path: string, body: Record<string, unknown> = {}) {
  const db = read();
  const me = demoUser(getDemoRole());
  const p = path.split("?")[0];
  const qs = new URLSearchParams(path.split("?")[1] || "");

  const svcById = (i: string) => db.Services.find((s) => s.serviceId === i);
  const rcpById = (i: string) => db.Recipients.find((r) => r.recipientId === i);
  const hhById = (i: string) => db.Households.find((h) => h.householdId === i);
  const usrById = (i: string) => db.Users.find((u) => u.userId === i);
  const myHouseholds = () => db.Households.filter((h) => h.primaryUserId === me.userId);
  const hours = (s: Row) => (s.clockIn && s.clockOut ? Math.max(0, (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / 3600000) : 0);
  const cgRate = (uid: string) => parseFloat(db.CaregiverProfiles.find((c) => c.userId === uid)?.rate || "0") || 0;

  // ---- auth
  if (p === "/api/auth" && method === "GET") return { user: me };

  // ---- services
  if (p === "/api/services" && method === "GET") return { services: db.Services };
  if (p === "/api/services" && method === "POST") {
    if (body.action === "update") { const s = db.Services.find((x) => x.serviceId === body.serviceId); if (s) Object.assign(s, { rate: String(body.rate ?? s.rate), active: String(body.active ?? s.active) }); write(db); return ok(); }
    if (body.action === "create") { db.Services.push({ serviceId: id("svc"), tenantId: IDS.tenant, category: String(body.category || "Custom"), name: String(body.name || "Untitled"), profileType: String(body.profileType || "person"), pricingModel: String(body.pricingModel || "hourly"), rate: String(body.rate || ""), credential: String(body.credential || "none"), durationMin: "60", active: "true" }); write(db); return ok(); }
    if (body.action === "seed") return { ok: true, seeded: 0, note: "demo already seeded" };
  }

  // ---- household
  if (p === "/api/household" && method === "GET") {
    const hh = myHouseholds()[0] || null;
    const recipients = hh ? db.Recipients.filter((r) => r.householdId === hh.householdId) : [];
    return { household: hh, recipients, members: [] };
  }
  if (p === "/api/household" && method === "POST") {
    let hh = myHouseholds()[0];
    if (!hh) { hh = { householdId: id("hh"), tenantId: IDS.tenant, primaryUserId: me.userId, name: "", address: "", city: "", zip: "", createdAt: now() }; db.Households.push(hh); }
    if (body.action === "ensure") { Object.assign(hh, { name: String(body.name || hh.name), address: String(body.address || ""), city: String(body.city || ""), zip: String(body.zip || "") }); write(db); return { ok: true, household: hh }; }
    if (body.action === "add_recipient") { const r = { recipientId: id("rcp"), tenantId: IDS.tenant, householdId: hh.householdId, name: String(body.name || "Unnamed"), type: String(body.type || "person"), dob: String(body.dob || ""), address: String(body.address || ""), conditions: String(body.conditions || ""), notes: String(body.notes || ""), photoUrl: "", createdAt: now() }; db.Recipients.push(r); write(db); return { ok: true, recipient: r }; }
    if (body.action === "update_recipient") { const r = rcpById(String(body.recipientId)); if (r) Object.assign(r, body); write(db); return ok(); }
    if (body.action === "invite") return { ok: true };
  }

  // ---- bookings
  if (p === "/api/bookings" && method === "GET") {
    let list = db.Bookings;
    if (me.role === "family") { const ids = myHouseholds().map((h) => h.householdId); list = list.filter((b) => ids.includes(b.householdId)); }
    else if (me.role === "caregiver") list = list.filter((b) => b.caregiverId === me.userId);
    const enriched = list.map((b) => ({ ...b, serviceName: svcById(b.serviceId)?.name || "", recipientName: rcpById(b.recipientId)?.name || "", recipientType: rcpById(b.recipientId)?.type || "", householdName: hhById(b.householdId)?.name || "", credential: svcById(b.serviceId)?.credential || "none" } as Row)).sort((a, b) => (a.start < b.start ? 1 : -1));
    return { bookings: enriched };
  }
  if (p === "/api/bookings" && method === "POST") {
    if (body.action === "create") { const hh = myHouseholds()[0]; const b = { bookingId: id("bk"), tenantId: IDS.tenant, householdId: hh.householdId, recipientId: String(body.recipientId), serviceId: String(body.serviceId), requestedBy: me.userId, status: "requested", start: String(body.start), end: "", recurrence: "none", caregiverId: "", notes: String(body.notes || ""), createdAt: now() }; db.Bookings.push(b); write(db); return { ok: true }; }
    if (body.action === "approve") { const b = db.Bookings.find((x) => x.bookingId === body.bookingId); if (b) { b.status = "scheduled"; b.caregiverId = String(body.caregiverId || ""); db.Shifts.push({ shiftId: id("sh"), tenantId: IDS.tenant, bookingId: b.bookingId, caregiverId: b.caregiverId, start: b.start, end: "", status: b.caregiverId ? "scheduled" : "open", clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "" }); } write(db); return ok(); }
    if (body.action === "decline") { const b = db.Bookings.find((x) => x.bookingId === body.bookingId); if (b) b.status = "declined"; write(db); return ok(); }
  }

  // ---- agency aggregate
  if (p === "/api/agency" && method === "GET") {
    const clients = db.Households.map((h) => ({ ...h, recipients: db.Recipients.filter((r) => r.householdId === h.householdId) }));
    const caregivers = db.Users.filter((u) => u.role === "caregiver").map((u) => ({ userId: u.userId, name: u.name, email: u.email, phone: u.phone, credentials: db.CaregiverProfiles.find((c) => c.userId === u.userId)?.credentials || "", status: "active" }));
    return { clients, caregivers };
  }

  // ---- shifts
  if (p === "/api/shifts" && method === "GET") {
    const enrich = (s: Row) => { const b = db.Bookings.find((x) => x.bookingId === s.bookingId) || {} as Row; const r = rcpById(b.recipientId) || {} as Row; const h = hhById(b.householdId) || {} as Row; return { ...s, householdId: b.householdId || "", serviceName: svcById(b.serviceId)?.name || "", recipientName: r.name || "", recipientType: r.type || "", careNotes: [r.conditions, r.notes].filter(Boolean).join(" · "), address: r.address || h.address || "", city: h.city || "", householdName: h.name || "", caregiverName: usrById(s.caregiverId)?.name || "" } as Row; };
    const all = db.Shifts.map(enrich);
    if (me.role === "caregiver") return { shifts: all.filter((s) => s.caregiverId === me.userId).sort((a, b) => (a.start < b.start ? -1 : 1)), open: all.filter((s) => s.status === "open") };
    if (me.role === "family") { const ids = myHouseholds().map((h) => h.householdId); return { shifts: all.filter((s) => ids.includes(s.householdId)).sort((a, b) => (a.start < b.start ? 1 : -1)) }; }
    return { shifts: all.sort((a, b) => (a.start < b.start ? -1 : 1)) };
  }
  if (p === "/api/shifts" && method === "POST") {
    const s = db.Shifts.find((x) => x.shiftId === body.shiftId);
    if (!s) return { error: "not found" };
    if (body.action === "claim") { s.caregiverId = me.userId; s.status = "scheduled"; const b = db.Bookings.find((x) => x.bookingId === s.bookingId); if (b) b.caregiverId = me.userId; }
    if (body.action === "clock_in") { s.clockIn = now(); s.gpsIn = String(body.gps || ""); s.status = "in_progress"; }
    if (body.action === "clock_out") { s.clockOut = now(); s.gpsOut = String(body.gps || ""); s.status = "completed"; if (body.notes) s.notes = s.notes ? `${s.notes}\n${body.notes}` : String(body.notes); const b = db.Bookings.find((x) => x.bookingId === s.bookingId); if (b) b.status = "completed"; }
    if (body.action === "assign") { s.caregiverId = String(body.caregiverId || ""); s.status = body.caregiverId ? "scheduled" : "open"; }
    write(db); return ok();
  }

  // ---- invoices
  if (p === "/api/invoices" && method === "GET") {
    let list = db.Invoices;
    if (me.role === "family") { const ids = myHouseholds().map((h) => h.householdId); list = list.filter((i) => ids.includes(i.householdId)); }
    const enriched = list.map((inv) => { const b = db.Bookings.find((x) => x.bookingId === inv.bookingId) || {} as Row; return { ...inv, serviceName: svcById(b.serviceId)?.name || "", recipientName: rcpById(b.recipientId)?.name || "", householdName: hhById(inv.householdId)?.name || "" } as Row; }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { invoices: enriched };
  }
  if (p === "/api/invoices" && method === "POST") {
    if (body.action === "pay") { const inv = db.Invoices.find((i) => i.invoiceId === body.invoiceId); if (inv) { inv.status = "paid"; inv.stripeId = "demo_paid"; } write(db); return { ok: true, demo: true }; }
    if (body.action === "generate") { const billed = new Set(db.Invoices.map((i) => i.bookingId)); let created = 0; for (const s of db.Shifts) { if (s.status !== "completed" || billed.has(s.bookingId)) continue; const b = db.Bookings.find((x) => x.bookingId === s.bookingId); if (!b) continue; const svc = svcById(b.serviceId); const amt = svc && svc.pricingModel === "hourly" ? (parseFloat(svc.rate || "0") * (hours(s) || 1)) : parseFloat(svc?.rate || "0"); db.Invoices.push({ invoiceId: id("inv"), tenantId: IDS.tenant, householdId: b.householdId, bookingId: b.bookingId, amount: (Math.round(amt * 100) / 100).toFixed(2), status: "unpaid", stripeId: "", createdAt: now() }); billed.add(b.bookingId); created++; } write(db); return { ok: true, created }; }
    if (body.action === "mark_paid" || body.action === "void") { const inv = db.Invoices.find((i) => i.invoiceId === body.invoiceId); if (inv) inv.status = body.action === "void" ? "void" : "paid"; write(db); return ok(); }
  }

  // ---- payroll
  if (p === "/api/payroll" && method === "GET") {
    const completed = db.Shifts.filter((s) => s.status === "completed" && s.caregiverId);
    if (me.role === "caregiver") {
      const mine = completed.filter((s) => s.caregiverId === me.userId);
      const lines = mine.map((s) => { const b = db.Bookings.find((x) => x.bookingId === s.bookingId) || {} as Row; return { date: s.clockOut || s.start, service: svcById(b.serviceId)?.name || "", recipient: rcpById(b.recipientId)?.name || "", hours: Math.round(hours(s) * 100) / 100, amount: Math.round(cgRate(me.userId) * (hours(s) || 1) * 100) / 100 }; });
      return { hours: Math.round(lines.reduce((a, l) => a + l.hours, 0) * 100) / 100, gross: Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100, lines };
    }
    const roll: Record<string, { userId: string; name: string; shifts: number; hours: number; gross: number }> = {};
    for (const s of completed) { const r = (roll[s.caregiverId] ||= { userId: s.caregiverId, name: usrById(s.caregiverId)?.name || s.caregiverId, shifts: 0, hours: 0, gross: 0 }); r.shifts++; r.hours += hours(s); r.gross += cgRate(s.caregiverId) * (hours(s) || 1); }
    const rows = Object.values(roll).map((r) => ({ ...r, hours: Math.round(r.hours * 100) / 100, gross: Math.round(r.gross * 100) / 100 }));
    return { rows, total: Math.round(rows.reduce((a, r) => a + r.gross, 0) * 100) / 100, backboneReady: false };
  }
  if (p === "/api/payroll" && method === "POST") return { ok: false, note: "Demo — connect Check or Gusto Embedded to issue real payouts. Timesheets and gross pay are ready." };

  // ---- connect (Stripe)
  if (p === "/api/connect" && method === "POST") {
    if (body.action === "status") return { connected: db.Tenant.stripeAccountId ? true : false, chargesEnabled: !!db.Tenant.stripeAccountId };
    if (body.action === "onboard") { db.Tenant.stripeAccountId = "acct_demo"; write(db); return { ok: true, demo: true }; }
  }

  // ---- documents
  if (p === "/api/documents" && method === "GET") {
    let list = db.Documents;
    if (me.role === "family") { const ids = myHouseholds().map((h) => h.householdId); list = list.filter((d) => ids.includes(d.householdId)); }
    else if (me.role === "caregiver") list = list.filter((d) => d.subjectType === "caregiver" && d.subjectId === me.userId);
    const enriched = list.map((d) => ({ ...d, templateLabel: d.title, householdName: hhById(d.householdId)?.name || "", recipientName: "" } as Row)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { documents: enriched };
  }
  if (p === "/api/documents" && method === "POST") {
    if (body.action === "create") { const titles: Record<string, string> = { service_agreement: "Service Agreement", care_plan: "Care Plan", consent: "Consent to Care", hipaa: "HIPAA Acknowledgment" }; const hh = hhById(String(body.householdId)); db.Documents.push({ docId: id("doc"), tenantId: IDS.tenant, subjectType: "household", subjectId: String(body.householdId), template: String(body.template), driveFileId: "", status: "unsigned", signedBy: "", signedAt: "", title: titles[String(body.template)] || "Document", content: `${titles[String(body.template)]}\n\nClient household: ${hh?.name || ""}\n\nBy signing, the Client agrees to the terms above.`, signature: "", householdId: String(body.householdId), createdAt: now() }); write(db); return ok(); }
    if (body.action === "sign") { const d = db.Documents.find((x) => x.docId === body.docId); if (d) { d.status = "signed"; d.signedBy = String(body.signerName || me.name); d.signedAt = now(); d.signature = String(body.signature || ""); } write(db); return ok(); }
  }

  // ---- leads
  if (p === "/api/leads" && method === "GET") {
    const stage = qs.get("stage") || ""; const q = (qs.get("q") || "").toLowerCase();
    let list = db.Leads;
    if (stage) list = list.filter((l) => l.stage === stage);
    if (q) list = list.filter((l) => `${l.name} ${l.email} ${l.city} ${l.zip}`.toLowerCase().includes(q));
    const counts: Record<string, number> = { new: 0, contacted: 0, consultation: 0, client: 0, lost: 0 };
    for (const l of db.Leads) if (counts[l.stage] !== undefined) counts[l.stage]++;
    return { total: list.length, grandTotal: db.Leads.length, counts, leads: list.slice(0, 50) };
  }
  if (p === "/api/leads" && method === "POST") {
    if (body.action === "import") { const rows = (body.leads as Row[]) || []; for (const r of rows) db.Leads.push({ leadId: id("lead"), tenantId: IDS.tenant, name: r.name || "", email: r.email || "", phone: r.phone || "", address: r.address || "", city: r.city || "", zip: r.zip || "", stage: "new", source: "import", notes: "", createdAt: now() }); write(db); return { ok: true, imported: rows.length }; }
    if (body.action === "update_stage") { const l = db.Leads.find((x) => x.leadId === body.leadId); if (l) l.stage = String(body.stage); write(db); return ok(); }
    if (body.action === "note") { const l = db.Leads.find((x) => x.leadId === body.leadId); if (l) l.notes = String(body.notes || ""); write(db); return ok(); }
  }

  // ---- waitlist (public)
  if (p === "/api/waitlist" && method === "POST") {
    db.Waitlist.push({ waitlistId: id("wl"), type: String(body.type || "direct"), name: String(body.name || ""), email: String(body.email || ""), phone: String(body.phone || ""), region: String(body.region || ""), timeframe: String(body.timeframe || ""), details: JSON.stringify(body.details || {}), consent: "yes", createdAt: now() });
    write(db);
    return { ok: true };
  }

  return { error: `demo: unhandled ${method} ${p}` };
}
