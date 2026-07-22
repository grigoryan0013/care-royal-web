// DEMO MODE — runs the entire app on seeded sample data, no backend/credentials.
// Activated by logging in as grigoryan / 201816. One identity can switch between
// the Agency, Family, and Caregiver portals to test every function. All actions
// mutate a localStorage DB so changes persist and show across portals.
import type { Role, SessionUser } from "./session";
import { generate } from "./templates";

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
  // Clear the backend FLAG too — otherwise /api calls keep routing to the mock
  // and a later REAL login still shows demo data next to the real business.
  localStorage.removeItem(FLAG);
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
  Documents: Row[]; Leads: Row[]; Waitlist: Row[]; Messages: Row[]; QuoteRequests: Row[];
  CaregiverApplications: Row[]; Reviews: Row[]; Events: Row[]; Tenant: Row;
  // roadmap features (optional so pre-existing demo DBs upgrade cleanly)
  Payers?: Row[]; Authorizations?: Row[]; Claims?: Row[]; Payouts?: Row[];
  ShiftSwaps?: Row[]; Journal?: Row[];
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
    Tenant: { tenantId: IDS.tenant, name: "The Care Royal", slug: "care-royal", plan: "standard", status: "active", stripeAccountId: "", createdAt: now() },
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
      { docId: "doc2", tenantId: IDS.tenant, subjectType: "caregiver", subjectId: IDS.cg, template: "hipaa", driveFileId: "", status: "unsigned", signedBy: "", signedAt: "", title: "HIPAA Acknowledgment", content: "HIPAA ACKNOWLEDGMENT\n\nI acknowledge The Care Royal may use health information as necessary to coordinate and deliver care.", signature: "", householdId: "", createdAt: now() },
    ],
    Leads: seedLeads(),
    QuoteRequests: [
      { quoteId: "qr1", tenantId: IDS.tenant, name: "Denise Carter", email: "denise.c@example.com", phone: "818-555-0170", city: "Burbank", zip: "91505", careFor: "person", recipientName: "my mother (82)", services: "Personal care, Companionship, Medication reminders", frequency: "3x per week", startDate: "", schedule: "Mornings preferred", budget: "", details: "Mom has limited mobility after a fall. Looking to start within two weeks.", bestTime: "Afternoons", status: "new", source: "quote", createdAt: agoHours(5) },
    ],
    Waitlist: [],
    CaregiverApplications: [
      { appId: "app1", tenantId: IDS.tenant, name: "Maria Lopez", email: "maria.l@example.com", phone: "213-555-0181", city: "Glendale", zip: "91205", credentials: "CNA, CPR", experience: "6 years senior care", availability: "Mon-Fri days", services: "Personal & senior care, Companion & non-medical", details: "Bilingual English/Spanish. Comfortable with dementia care.", status: "new", createdAt: agoHours(8) },
    ],
    Reviews: [
      { reviewId: "rv1", tenantId: IDS.tenant, rating: "5", name: "The Miller Family", text: "Ana is wonderful with my mother — punctual, kind, and communicative.", createdAt: agoHours(72) },
      { reviewId: "rv2", tenantId: IDS.tenant, rating: "5", name: "R. Chen", text: "Booking and scheduling was effortless. Highly recommend.", createdAt: agoHours(200) },
      { reviewId: "rv3", tenantId: IDS.tenant, rating: "4", name: "G. Park", text: "Great caregivers. Would love more weekend availability.", createdAt: agoHours(400) },
    ],
    Events: [
      { eventId: "ev1", tenantId: IDS.tenant, text: "Approved booking · 1 shift", actor: "Owner", createdAt: agoHours(26) },
      { eventId: "ev2", tenantId: IDS.tenant, text: "Care Plan signed by Jordan Miller", actor: "Jordan Miller", createdAt: agoHours(20) },
    ],
    Messages: [
      { messageId: "msg1", tenantId: IDS.tenant, householdId: "hh1", fromUid: IDS.family, fromName: "Jordan Miller", fromRole: "family", text: "Hi, could Ana arrive a little earlier on Friday?", createdAt: agoHours(20) },
      { messageId: "msg2", tenantId: IDS.tenant, householdId: "hh1", fromUid: IDS.admin, fromName: "Care team", fromRole: "agency_admin", text: "Of course — we'll confirm with Ana and update the schedule.", createdAt: agoHours(19) },
      { messageId: "msg3", tenantId: IDS.tenant, householdId: "hh1", fromUid: IDS.cg, fromName: "Ana Reyes", fromRole: "caregiver", text: "Happy to come at 9am instead. See you Friday!", createdAt: agoHours(18) },
    ],
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
export async function demoHandle(method: string, path: string, body: Record<string, unknown> = {}): Promise<any> {
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

  // ---- team (owner: managers & staff)
  if (p === "/api/team") {
    if (method === "GET") {
      const team = db.Users.filter((u) => u.role === "manager" || u.role === "caregiver")
        .map((u) => ({ userId: u.userId, name: u.name, email: u.email, phone: u.phone || "", role: u.role, status: u.status || "active", permissions: {} }));
      return { team };
    }
    const u = db.Users.find((x) => x.userId === body.userId);
    if (u) {
      if (body.action === "approve" || body.action === "reactivate") u.status = "active";
      if (body.action === "suspend") u.status = "suspended";
      write(db);
    }
    return ok();
  }

  // ---- tenant
  if (p === "/api/tenant" && method === "GET") return { tenant: { tenantId: IDS.tenant, name: db.Tenant.name || "The Care Royal", plan: db.Tenant.plan || "demo", joinCode: "DEMO24", status: "active" } };

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
    if (body.action === "create") {
      const isAgency = me.role === "agency_admin" || me.role === "agency_coord" || me.role === "manager";
      let householdId = String(body.householdId || "");
      if (!isAgency) { const hh = myHouseholds()[0]; householdId = hh.householdId; }
      else if (!householdId && body.recipientId) { householdId = db.Recipients.find((r) => r.recipientId === body.recipientId)?.householdId || ""; }
      if (!householdId) return { error: "choose a client for this appointment" };
      const recurrence = body.recurrence === "weekly" ? "weekly" : "none";
      const occurrences = recurrence === "weekly" ? Math.min(26, Math.max(1, parseInt(String(body.occurrences || 4)) || 4)) : 1;
      const status = isAgency ? "scheduled" : "requested";
      const caregiverId = isAgency ? String(body.caregiverId || "") : "";
      const b = { bookingId: id("bk"), tenantId: IDS.tenant, householdId, recipientId: String(body.recipientId), serviceId: String(body.serviceId), requestedBy: me.userId, status, start: String(body.start), end: "", recurrence, occurrences: String(occurrences), caregiverId, notes: String(body.notes || ""), createdAt: now() };
      db.Bookings.push(b);
      if (isAgency) { const base = body.start ? new Date(String(body.start)) : null; for (let i = 0; i < occurrences; i++) { const start = base ? new Date(base.getTime() + i * 7 * 864e5).toISOString() : String(body.start); db.Shifts.push({ shiftId: id("sh"), tenantId: IDS.tenant, bookingId: b.bookingId, caregiverId, start, end: "", status: caregiverId ? "scheduled" : "open", clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "" }); } }
      write(db); return { ok: true };
    }
    if (body.action === "approve") { const b = db.Bookings.find((x) => x.bookingId === body.bookingId); if (b) { b.status = "scheduled"; b.caregiverId = String(body.caregiverId || ""); const occ = b.recurrence === "weekly" ? Math.min(26, Math.max(1, parseInt(b.occurrences || "1") || 1)) : 1; const base = b.start ? new Date(b.start) : null; for (let i = 0; i < occ; i++) { const start = base ? new Date(base.getTime() + i * 7 * 864e5).toISOString() : b.start; db.Shifts.push({ shiftId: id("sh"), tenantId: IDS.tenant, bookingId: b.bookingId, caregiverId: b.caregiverId, start, end: "", status: b.caregiverId ? "scheduled" : "open", clockIn: "", clockOut: "", gpsIn: "", gpsOut: "", notes: "" }); } } write(db); return ok(); }
    if (body.action === "decline") { const b = db.Bookings.find((x) => x.bookingId === body.bookingId); if (b) b.status = "declined"; write(db); return ok(); }
    if (body.action === "assign") { const b = db.Bookings.find((x) => x.bookingId === body.bookingId); if (b) b.caregiverId = String(body.caregiverId || ""); const sh = db.Shifts.find((s) => s.bookingId === body.bookingId); if (sh) { sh.caregiverId = String(body.caregiverId || ""); sh.status = body.caregiverId ? "scheduled" : "open"; } write(db); return ok(); }
    if (body.action === "reschedule") { const b = db.Bookings.find((x) => x.bookingId === body.bookingId); if (b) { b.start = String(body.start || ""); b.end = String(body.end || ""); } const sh = db.Shifts.find((s) => s.bookingId === body.bookingId); if (sh) { sh.start = String(body.start || ""); sh.end = String(body.end || ""); } write(db); return ok(); }
    if (body.action === "cancel") { const b = db.Bookings.find((x) => x.bookingId === body.bookingId); if (b) b.status = "cancelled"; const sh = db.Shifts.find((s) => s.bookingId === body.bookingId); if (sh) sh.status = "cancelled"; write(db); return ok(); }
  }

  // ---- agency aggregate
  if (p === "/api/agency" && method === "GET") {
    const clients = db.Households.map((h) => ({ ...h, recipients: db.Recipients.filter((r) => r.householdId === h.householdId) }));
    const joined = db.Users.filter((u) => u.role === "caregiver").map((u) => { const pr = db.CaregiverProfiles.find((c) => c.userId === u.userId); return { userId: u.userId, name: u.name, email: u.email, phone: u.phone, credentials: pr?.credentials || "", credentialExpiry: pr?.credentialExpiry || "", rate: pr?.rate || "", availability: pr?.availability || "", bgCheckStatus: pr?.bgCheckStatus || "", status: "active" }; });
    const roster = db.CaregiverProfiles.filter((pr) => (pr.imported === "true" || !pr.userId) && (pr.name || pr.email)).map((pr) => ({ userId: pr.profileId || "", name: pr.name || "", email: pr.email || "", phone: pr.phone || "", credentials: pr.credentials || "", credentialExpiry: pr.credentialExpiry || "", rate: pr.rate || "", availability: "", bgCheckStatus: "", status: "roster" }));
    return { clients, caregivers: [...joined, ...roster] };
  }
  if (p === "/api/agency" && method === "POST") {
    if (body.action === "assign_caregiver") { const h = hhById(String(body.householdId)); if (h) h.primaryCaregiverId = String(body.caregiverId || ""); write(db); return ok(); }
    if (body.action === "set_caregiver") { let pr = db.CaregiverProfiles.find((c) => c.userId === body.userId); if (!pr) { pr = { userId: String(body.userId), tenantId: IDS.tenant }; db.CaregiverProfiles.push(pr); } for (const k of ["credentials", "credentialExpiry", "rate"]) if (k in body) pr[k] = String((body as Row)[k]); write(db); return ok(); }
    if (body.action === "import_clients") {
      const rows = Array.isArray(body.rows) ? (body.rows as Row[]) : [];
      for (const r of rows) { if (!r.name && !r.recipient && !r.email && !r.phone) continue; const hid = id("hh"); db.Households.push({ householdId: hid, tenantId: IDS.tenant, primaryUserId: "", name: r.name || r.recipient || "Imported client", address: r.address || "", city: r.city || "", zip: r.zip || "", phone: r.phone || "", email: r.email || "" }); db.Recipients.push({ recipientId: id("r"), tenantId: IDS.tenant, householdId: hid, name: r.recipient || r.name || "Care recipient", type: "person", conditions: r.conditions || "", notes: r.notes || "" }); }
      write(db); return { ok: true, imported: rows.length };
    }
    if (body.action === "import_staff") {
      const rows = Array.isArray(body.rows) ? (body.rows as Row[]) : [];
      for (const r of rows) { if (!r.name && !r.email && !r.phone) continue; db.CaregiverProfiles.push({ profileId: id("cp"), userId: "", imported: "true", tenantId: IDS.tenant, name: r.name || "", email: r.email || "", phone: r.phone || "", credentials: r.credentials || "", credentialExpiry: r.credentialExpiry || "", rate: r.rate || "" }); }
      write(db); return { ok: true, imported: rows.length };
    }
  }

  // ---- caregiver self profile
  if (p === "/api/profile") {
    let pr = db.CaregiverProfiles.find((c) => c.userId === me.userId);
    if (method === "GET") return { profile: pr || { userId: me.userId, credentials: "", credentialExpiry: "", rate: "", bio: "", availability: "" } };
    if (!pr) { pr = { userId: me.userId, tenantId: IDS.tenant }; db.CaregiverProfiles.push(pr); }
    for (const k of ["credentials", "credentialExpiry", "rate", "bio", "availability"]) if (k in body) pr[k] = String((body as Row)[k]);
    write(db); return ok();
  }

  // ---- recruiting (applications), audit events
  if (p === "/api/applications" && method === "GET") return { applications: db.CaregiverApplications.slice().sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
  if (p === "/api/applications" && method === "POST") { const a = db.CaregiverApplications.find((x) => x.appId === body.appId); if (a) a.status = body.action === "accept" ? "accepted" : "declined"; write(db); return ok(); }
  if (p === "/api/events" && method === "GET") return { events: db.Events.slice().sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)).slice(0, 60) };
  if (p === "/api/apply" && method === "POST") { db.CaregiverApplications.push({ appId: id("app"), tenantId: IDS.tenant, name: String(body.name || ""), email: String(body.email || ""), phone: String(body.phone || ""), city: String(body.city || ""), zip: String(body.zip || ""), credentials: String(body.credentials || ""), experience: String(body.experience || ""), availability: Array.isArray(body.availability) ? (body.availability as string[]).join(", ") : String(body.availability || ""), services: Array.isArray(body.services) ? (body.services as string[]).join(", ") : String(body.services || ""), details: String(body.details || ""), status: "new", createdAt: now() }); write(db); return { ok: true, agency: db.Tenant.name || "The Care Royal" }; }
  if (p === "/api/review" && method === "POST") { db.Reviews.push({ reviewId: id("rv"), tenantId: IDS.tenant, rating: String(Math.max(1, Math.min(5, parseInt(String(body.rating)) || 5))), name: String(body.name || "Anonymous"), text: String(body.text || ""), createdAt: now() }); write(db); return { ok: true }; }
  if (p === "/api/agency-public" && method === "GET") { const reviews = db.Reviews.slice().sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)); const avg = reviews.length ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length : 0; return { agency: { name: db.Tenant.brandName || db.Tenant.name || "The Care Royal", code: "DEMO24" }, reviews: reviews.slice(0, 20), avg: Math.round(avg * 10) / 10, count: reviews.length, site: db.Tenant.site || null, brandColor: db.Tenant.brandColor || "", logoUrl: db.Tenant.logoUrl || "" }; }

  // ---- caregiver availability
  if (p === "/api/availability") {
    let pr = db.CaregiverProfiles.find((c) => c.userId === me.userId);
    if (method === "GET") return { availability: pr?.availability || "" };
    if (!pr) { pr = { userId: me.userId, tenantId: IDS.tenant, credentials: "", rate: "", availability: "" }; db.CaregiverProfiles.push(pr); }
    pr.availability = typeof body.availability === "string" ? body.availability : JSON.stringify(body.availability || {});
    write(db); return ok();
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
    const enriched = list.map((inv) => { const b = db.Bookings.find((x) => x.bookingId === inv.bookingId) || {} as Row; return { ...inv, serviceName: svcById(b.serviceId)?.name || "", recipientName: rcpById(b.recipientId)?.name || "", householdName: hhById(inv.householdId)?.name || "" } as Row; }).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1));
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
    const provider = db.Tenant.payrollProvider || "";
    return { rows, total: Math.round(rows.reduce((a, r) => a + r.gross, 0) * 100) / 100, provider, backboneReady: !!provider };
  }
  if (p === "/api/payroll" && method === "POST") {
    if (body.action === "connect_payroll") { db.Tenant.payrollProvider = String(body.provider || "gusto"); write(db); return { ok: true, connected: true, demo: true }; }
    if (body.action === "exchange_gusto") { db.Tenant.payrollProvider = "gusto"; write(db); return { ok: true, connected: true, demo: true }; }
    return { ok: false, note: "Gross pay is ready. Connect your payroll provider (Gusto) to issue payouts." };
  }

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
    const enriched = list.map((d) => ({ ...d, templateLabel: d.title, householdName: hhById(d.householdId)?.name || "", recipientName: "" } as Row)).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1));
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

  // ---- messaging
  if (p === "/api/threads" && method === "GET") {
    let hids: string[];
    if (me.role === "family") hids = db.Households.filter((h) => h.primaryUserId === me.userId).map((h) => h.householdId);
    else if (me.role === "caregiver") hids = Array.from(new Set(db.Bookings.filter((b) => b.caregiverId === me.userId).map((b) => b.householdId)));
    else hids = db.Households.map((h) => h.householdId);
    const last: Record<string, Row> = {};
    for (const msg of db.Messages) { const c = last[msg.householdId]; if (!c || msg.createdAt > c.createdAt) last[msg.householdId] = msg; }
    const threads = hids.map((hid) => ({ householdId: hid, name: hhById(hid)?.name || "Client", lastText: last[hid]?.text || "", lastAt: last[hid]?.createdAt || "" })).sort((a, b) => ((a as any).lastAt < (b as any).lastAt ? 1 : -1));
    return { threads };
  }
  if (p === "/api/messages" && method === "GET") {
    const hid = qs.get("householdId") || "";
    return { messages: db.Messages.filter((x) => x.householdId === hid).sort((a, b) => ((a as any).createdAt < (b as any).createdAt ? -1 : 1)) };
  }
  if (p === "/api/messages" && method === "POST") {
    db.Messages.push({ messageId: id("msg"), tenantId: IDS.tenant, householdId: String(body.householdId), fromUid: me.userId, fromName: me.name, fromRole: me.role, text: String(body.text || ""), createdAt: now() });
    write(db); return ok();
  }

  // ---- quote requests
  if (p === "/api/quote" && method === "POST") {
    db.QuoteRequests.push({ quoteId: id("qr"), tenantId: IDS.tenant, name: String(body.name || ""), email: String(body.email || ""), phone: String(body.phone || ""), city: String(body.city || ""), zip: String(body.zip || ""), careFor: String(body.careFor || ""), recipientName: String(body.recipientName || ""), services: Array.isArray(body.services) ? (body.services as string[]).join(", ") : String(body.services || ""), frequency: String(body.frequency || ""), startDate: String(body.startDate || ""), schedule: String(body.schedule || ""), budget: String(body.budget || ""), details: String(body.details || ""), bestTime: String(body.bestTime || ""), status: "new", source: "quote", createdAt: now() });
    write(db); return { ok: true, agency: db.Tenant.name || "The Care Royal" };
  }
  if (p === "/api/quote-requests" && method === "GET") return { requests: db.QuoteRequests.slice().sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
  if (p === "/api/quote-requests" && method === "POST") {
    const q = db.QuoteRequests.find((x) => x.quoteId === body.quoteId);
    if (body.action === "dismiss" && q) q.status = "dismissed";
    if (body.action === "convert" && q) { db.Leads.push({ leadId: id("lead"), tenantId: IDS.tenant, name: q.name, email: q.email, phone: q.phone, address: "", city: q.city, zip: q.zip, stage: "new", source: "quote", notes: [q.services, q.frequency, q.details].filter(Boolean).join(" · "), createdAt: now() }); q.status = "converted"; }
    write(db); return ok();
  }

  // ---- waitlist (public)
  if (p === "/api/waitlist" && method === "POST") {
    db.Waitlist.push({ waitlistId: id("wl"), type: String(body.type || "direct"), name: String(body.name || ""), email: String(body.email || ""), phone: String(body.phone || ""), region: String(body.region || ""), timeframe: String(body.timeframe || ""), details: JSON.stringify(body.details || {}), consent: "yes", createdAt: now() });
    write(db);
    return { ok: true };
  }

  // ---- ROADMAP FEATURES (mirror of fb.ts) --------------------------------
  const arr = (k: keyof Db): Row[] => ((db[k] as Row[]) ||= [] as Row[]);

  // Item 1: EVV + claims
  if (p === "/api/payers") {
    if (method === "GET") return { payers: arr("Payers").slice().sort((a, b) => (a.name < b.name ? -1 : 1)) };
    if (body.action === "create") { const py = { payerId: id("payer"), tenantId: IDS.tenant, name: String(body.name || "Untitled payer"), type: String(body.type || "medicaid"), payerId2: String(body.payerId2 || ""), state: String(body.state || ""), evvFormat: String(body.evvFormat || "hhaexchange"), createdAt: now() }; arr("Payers").push(py); write(db); return { ok: true, payer: py }; }
    if (body.action === "update") { const py = arr("Payers").find((x) => x.payerId === body.payerId); if (py) for (const k of ["name", "type", "payerId2", "state", "evvFormat"]) if (k in body) py[k] = String((body as Row)[k]); write(db); return ok(); }
  }
  if (p === "/api/authorizations") {
    if (method === "GET") return { authorizations: arr("Authorizations").map((a) => ({ ...a, recipientName: rcpById(a.recipientId)?.name || "", serviceName: svcById(a.serviceId)?.name || "", payerName: arr("Payers").find((x) => x.payerId === a.payerId)?.name || "" })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
    if (body.action === "create") { const a = { authId: id("auth"), tenantId: IDS.tenant, payerId: String(body.payerId || ""), recipientId: String(body.recipientId || ""), serviceId: String(body.serviceId || ""), authNumber: String(body.authNumber || ""), unitsApproved: String(body.unitsApproved || "0"), unitsUsed: "0", startDate: String(body.startDate || ""), endDate: String(body.endDate || ""), createdAt: now() }; arr("Authorizations").push(a); write(db); return { ok: true, authorization: a }; }
    if (body.action === "update") { const a = arr("Authorizations").find((x) => x.authId === body.authId); if (a) for (const k of ["payerId", "recipientId", "serviceId", "authNumber", "unitsApproved", "startDate", "endDate"]) if (k in body) a[k] = String((body as Row)[k]); write(db); return ok(); }
  }
  if (p === "/api/evv" && method === "GET") {
    const rows = db.Shifts.filter((s) => s.status === "completed" && s.clockIn && s.clockOut).map((s) => { const b = db.Bookings.find((x) => x.bookingId === s.bookingId) || {} as Row; const r = rcpById(b.recipientId) || {} as Row; const h = hhById(b.householdId) || {} as Row; const svc = svcById(b.serviceId) || {} as Row; return { visitId: s.shiftId, date: (s.clockIn || "").slice(0, 10), clockIn: s.clockIn, clockOut: s.clockOut, hours: Math.round(hours(s) * 100) / 100, service: svc.name || "", billingCode: svc.billingCode || "", recipient: r.name || "", address: r.address || h.address || "", caregiver: usrById(s.caregiverId)?.name || "", gpsIn: s.gpsIn || "", gpsOut: s.gpsOut || "", verified: s.gpsIn && s.gpsOut ? "yes" : "manual" }; });
    return { rows };
  }
  if (p === "/api/claims") {
    if (method === "GET") return { claims: arr("Claims").map((c) => ({ ...c, recipientName: rcpById(c.recipientId)?.name || "", serviceName: svcById(c.serviceId)?.name || "", payerName: arr("Payers").find((x) => x.payerId === c.payerId)?.name || "" })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) };
    if (body.action === "generate") { const claimed = new Set(arr("Claims").map((c) => c.shiftId)); let created = 0; for (const s of db.Shifts) { if (s.status !== "completed" || claimed.has(s.shiftId)) continue; const b = db.Bookings.find((x) => x.bookingId === s.bookingId); if (!b) continue; const svc = svcById(b.serviceId); if (!svc || !svc.billingCode) continue; const auth = arr("Authorizations").find((a) => a.recipientId === b.recipientId && a.serviceId === b.serviceId); const rate = parseFloat(svc.payerRate || svc.rate || "0") || 0; const amt = svc.pricingModel === "hourly" ? rate * (hours(s) || 1) : rate; arr("Claims").push({ claimId: id("clm"), tenantId: IDS.tenant, shiftId: s.shiftId, payerId: auth?.payerId || "", recipientId: b.recipientId, serviceId: b.serviceId, authNumber: auth?.authNumber || "", billingCode: svc.billingCode, units: String(Math.max(1, Math.round(hours(s) || 1))), amount: (Math.round(amt * 100) / 100).toFixed(2), dateOfService: (s.clockIn || s.start || "").slice(0, 10), status: "ready", createdAt: now() }); created++; } write(db); return { ok: true, created }; }
    if (body.action === "mark_submitted") { const c = arr("Claims").find((x) => x.claimId === body.claimId); if (c) c.status = "submitted"; write(db); return ok(); }
    if (body.action === "mark_paid") { const c = arr("Claims").find((x) => x.claimId === body.claimId); if (c) c.status = "paid"; write(db); return ok(); }
  }

  // Item 2: instant pay
  if (p === "/api/payouts") {
    const rate = (uid: string) => cgRate(uid);
    const accrued = (uid: string) => db.Shifts.filter((s) => s.status === "completed" && s.caregiverId === uid).reduce((a, s) => a + rate(uid) * (hours(s) || 1), 0);
    const paidOut = (uid: string) => arr("Payouts").filter((x) => x.caregiverId === uid && x.status !== "failed").reduce((a, x) => a + (parseFloat(x.gross) || 0), 0);
    const FEE = 1.99;
    if (method === "GET") {
      if (me.role === "caregiver") { const available = Math.max(0, Math.round((accrued(me.userId) - paidOut(me.userId)) * 100) / 100); return { available, fee: FEE, payouts: arr("Payouts").filter((x) => x.caregiverId === me.userId).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) }; }
      return { payouts: arr("Payouts").map((x) => ({ ...x, name: usrById(x.caregiverId)?.name || x.caregiverId })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)), totalFees: Math.round(arr("Payouts").reduce((a, x) => a + (parseFloat(x.fee) || 0), 0) * 100) / 100 };
    }
    if (body.action === "cash_out" && me.role === "caregiver") { const available = Math.round((accrued(me.userId) - paidOut(me.userId)) * 100) / 100; const gross = Math.min(available, Math.max(0, parseFloat(String(body.amount)) || available)); if (gross < 1) return { error: "Nothing available to cash out yet." }; arr("Payouts").push({ payoutId: id("po"), tenantId: IDS.tenant, caregiverId: me.userId, gross: gross.toFixed(2), fee: FEE.toFixed(2), net: (gross - FEE).toFixed(2), method: "instant", status: "paid", createdAt: now() }); write(db); return { ok: true, demo: true }; }
  }

  // Item 4: Assistant — same in-code template engine as full mode (no AI key).
  if (p === "/api/ai" && method === "POST") {
    return { text: generate(String(body.task || ""), (body.input || {}) as Row), ai: false };
  }

  // Item 5: scheduling + swaps
  if (p === "/api/schedule" && method === "POST" && body.action === "auto_assign") {
    const cg = db.Users.filter((u) => u.role === "caregiver"); const open = db.Shifts.filter((s) => s.status === "open"); let assigned = 0;
    for (const s of open) { const b = db.Bookings.find((x) => x.bookingId === s.bookingId) || {} as Row; const cand = cg[0]; if (cand) { s.caregiverId = cand.userId; s.status = "scheduled"; if (b.bookingId) b.caregiverId = cand.userId; assigned++; } }
    write(db); return { ok: true, assigned, remaining: open.length - assigned };
  }
  if (p === "/api/swaps") {
    if (method === "GET") return { swaps: arr("ShiftSwaps").filter((sw) => sw.status === "open").map((sw) => { const s = db.Shifts.find((x) => x.shiftId === sw.shiftId) || {} as Row; const b = db.Bookings.find((x) => x.bookingId === s.bookingId) || {} as Row; return { ...sw, start: s.start || "", serviceName: svcById(b.serviceId)?.name || "", recipientName: rcpById(b.recipientId)?.name || "", fromName: usrById(sw.fromCaregiverId)?.name || "" }; }) };
    if (body.action === "post") { const s = db.Shifts.find((x) => x.shiftId === body.shiftId); if (!s || s.caregiverId !== me.userId) return { error: "You can only post your own shift." }; s.caregiverId = ""; s.status = "open"; const b = db.Bookings.find((x) => x.bookingId === s.bookingId); if (b) b.caregiverId = ""; arr("ShiftSwaps").push({ swapId: id("swap"), tenantId: IDS.tenant, shiftId: String(body.shiftId), fromCaregiverId: me.userId, reason: String(body.reason || ""), status: "open", createdAt: now() }); write(db); return { ok: true }; }
    if (body.action === "claim") { const sw = arr("ShiftSwaps").find((x) => x.swapId === body.swapId); if (!sw || sw.status !== "open") return { error: "That swap is no longer available." }; const s = db.Shifts.find((x) => x.shiftId === sw.shiftId); if (!s || s.status !== "open") { sw.status = "claimed"; write(db); return { error: "That shift is no longer open." }; } s.caregiverId = me.userId; s.status = "scheduled"; const b = db.Bookings.find((x) => x.bookingId === s.bookingId); if (b) b.caregiverId = me.userId; sw.status = "claimed"; sw.toCaregiverId = me.userId; write(db); return ok(); }
    if (body.action === "cancel") { const sw = arr("ShiftSwaps").find((x) => x.swapId === body.swapId); if (sw) sw.status = "cancelled"; write(db); return ok(); }
  }

  // Item 6: branding / org
  if (p === "/api/site") {
    if (method === "GET") return { site: db.Tenant.site || null };
    (db.Tenant as any).site = body.site; write(db); return { ok: true };
  }
  if (p === "/api/branding") {
    if (method === "GET") return { branding: { logoUrl: db.Tenant.logoUrl || "", brandColor: db.Tenant.brandColor || "", accentColor: db.Tenant.accentColor || "", displayName: db.Tenant.brandName || db.Tenant.name || "", customDomain: db.Tenant.customDomain || "" } };
    for (const [k, f] of [["logoUrl", "logoUrl"], ["brandColor", "brandColor"], ["accentColor", "accentColor"], ["displayName", "brandName"], ["customDomain", "customDomain"]] as [string, string][]) if (k in body) db.Tenant[f] = String((body as Row)[k]);
    write(db); return ok();
  }
  if (p === "/api/org" && method === "GET") return { org: { orgId: "org_demo", name: db.Tenant.name || "The Care Royal" }, locations: [{ tenantId: IDS.tenant, name: db.Tenant.name || "The Care Royal", plan: db.Tenant.plan || "demo", status: "active", city: "Los Angeles" }] };
  if (p === "/api/org" && method === "POST") return { ok: true, demo: true };

  // Item 7: background checks
  if (p === "/api/background" && method === "POST") {
    const pr = db.CaregiverProfiles.find((c) => c.userId === body.userId);
    if (body.action === "invite" && pr) pr.bgCheckStatus = "pending";
    if (body.action === "clear" && pr) pr.bgCheckStatus = "clear";
    write(db); return { ok: true, status: pr?.bgCheckStatus || "pending" };
  }

  // Item 8: care journal
  if (p === "/api/journal") {
    if (method === "GET") { const hid = qs.get("householdId") || ""; let list = arr("Journal"); if (me.role === "family") { const ids = myHouseholds().map((h) => h.householdId); list = list.filter((j) => ids.includes(j.householdId)); } if (hid) list = list.filter((j) => j.householdId === hid); return { entries: list.map((j) => ({ ...j, authorName: usrById(j.authorId)?.name || j.authorName || "Care team" })).sort((a, b) => ((a as Row).createdAt < (b as Row).createdAt ? 1 : -1)) }; }
    if (body.action === "post") { if (!body.householdId) return { error: "Missing household." }; const e = { entryId: id("jrnl"), tenantId: IDS.tenant, householdId: String(body.householdId), authorId: me.userId, authorName: me.name, authorRole: me.role, text: String(body.text || ""), photoUrl: String(body.photoUrl || ""), shiftId: String(body.shiftId || ""), createdAt: now() }; arr("Journal").push(e); write(db); return { ok: true, entry: e }; }
  }

  // Item 9: benchmarking
  if (p === "/api/benchmarks" && method === "GET") {
    const assignable = db.Shifts.filter((s) => s.status !== "cancelled").length; const filled = db.Shifts.filter((s) => s.status !== "open" && s.status !== "cancelled").length;
    const rates = db.CaregiverProfiles.map((c) => parseFloat(c.rate || "0")).filter((r) => r > 0); const avgWage = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : 0;
    const collected = db.Invoices.filter((i) => i.status === "paid").reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
    const mine = { fillRate: assignable ? Math.round((filled / assignable) * 100) : 0, avgWage, caregivers: db.Users.filter((u) => u.role === "caregiver").length, collected: Math.round(collected) };
    return { mine, peers: { fillRate: 82, avgWage: 21.5, caregivers: 14 }, cohort: "agencies your size" };
  }

  // Item 10: quickbooks + audit pack
  if (p === "/api/quickbooks" && method === "POST") {
    if (body.action === "status") return { connected: !!db.Tenant.qboRealmId };
    if (body.action === "connect") { db.Tenant.qboRealmId = "demo_realm"; write(db); return { ok: true, demo: true }; }
    if (body.action === "exchange") { db.Tenant.qboRealmId = "demo_realm"; write(db); return { ok: true, connected: true, demo: true }; }
    if (body.action === "sync") return { ok: true, synced: db.Invoices.length, demo: true };
  }
  if (p === "/api/audit-pack" && method === "GET") {
    const evv = (await demoHandle("GET", "/api/evv")).rows || [];
    const documents = (db.Documents || []).filter((d) => d.status === "signed");
    return { agency: db.Tenant.name || "The Care Royal", generatedAt: now(), evv, documents, events: db.Events.slice(0, 60), claims: arr("Claims") };
  }

  return { error: `demo: unhandled ${method} ${p}` };
}
