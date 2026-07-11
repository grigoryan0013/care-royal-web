"use client";
import { useCallback, useEffect, useState } from "react";
import PortalShell, { type NavItem } from "../../components/PortalShell";
import CalendarView from "../../components/CalendarView";
import MessagesPanel from "../../components/MessagesPanel";
import { apiGet, apiPost } from "../lib/session";

const nav: NavItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "approvals", label: "Approvals" },
  { key: "clients", label: "Clients" },
  { key: "staff", label: "Staff" },
  { key: "services", label: "Services" },
  { key: "schedule", label: "Schedule" },
  { key: "calendar", label: "Calendar" },
  { key: "messages", label: "Messages" },
  { key: "money", label: "Money" },
  { key: "documents", label: "Documents" },
  { key: "leads", label: "Leads" },
];

interface Service { serviceId: string; category: string; name: string; profileType: string; pricingModel: string; rate: string; credential: string; active: string }
interface Caregiver { userId: string; name: string; email: string; phone: string; credentials: string; status: string }
interface Recipient { recipientId: string; name: string; type: string; conditions: string }
interface Client { householdId: string; name: string; city: string; recipients: Recipient[] }
interface Booking { bookingId: string; status: string; start: string; serviceName: string; recipientName: string; householdName: string; credential: string; notes: string; caregiverId: string }

interface Shift { shiftId: string; status: string; start: string; serviceName: string; recipientName: string; householdName: string; caregiverName: string; clockIn: string; clockOut: string; notes: string }


export default function AgencyPortal() {
  const [active, setActive] = useState("dashboard");
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [s, a, b, sh] = await Promise.all([
      apiGet("/api/services").catch(() => ({ services: [] })),
      apiGet("/api/agency").catch(() => ({ clients: [], caregivers: [] })),
      apiGet("/api/bookings").catch(() => ({ bookings: [] })),
      apiGet("/api/shifts").catch(() => ({ shifts: [] })),
    ]);
    setServices(s.services || []);
    setClients(a.clients || []); setCaregivers(a.caregivers || []);
    setBookings(b.bookings || []);
    setShifts(sh.shifts || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3000); }

  const pending = bookings.filter((b) => b.status === "requested");

  return (
    <PortalShell title="Agency console" allow={["agency_admin", "agency_coord"]} nav={nav} active={active} onNav={setActive}>
      <h1 className="mb-1 font-serif text-3xl text-ink">{nav.find((n) => n.key === active)?.label}</h1>
      <p className="mb-6 text-sm text-ink-light">Agency console</p>
      {msg && <p className="mb-4 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}

      {active === "dashboard" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Pending approvals", String(pending.length)],
            ["Total bookings", String(bookings.length)],
            ["Clients", String(clients.length)],
            ["Caregivers", String(caregivers.length)],
          ].map(([label, val]) => (
            <div key={label} className="card"><div className="text-3xl font-semibold text-brand">{val}</div><div className="mt-1 text-sm text-ink-mid">{label}</div></div>
          ))}
        </div>
      )}

      {active === "approvals" && <Approvals pending={pending} caregivers={caregivers} onChange={() => { load(); flash("Updated."); }} />}
      {active === "clients" && <Clients clients={clients} />}
      {active === "staff" && <Staff caregivers={caregivers} />}
      {active === "services" && <Services services={services} onChange={() => { load(); flash("Catalog updated."); }} />}
      {active === "schedule" && <Schedule shifts={shifts} />}
      {active === "calendar" && <CalendarView events={shifts.map((s) => ({ date: s.start, label: s.serviceName, sub: s.caregiverName || "Unassigned", tone: s.status === "completed" ? "ok" : s.status === "in_progress" ? "gold" : "brand" }))} />}
      {active === "messages" && <MessagesPanel />}
      {active === "money" && <Money />}
      {active === "documents" && <AgencyDocs clients={clients} onChange={() => flash("Document sent.")} />}
      {active === "leads" && <Leads />}
    </PortalShell>
  );
}

function Approvals({ pending, caregivers, onChange }: { pending: Booking[]; caregivers: Caregiver[]; onChange: () => void }) {
  return (
    <div className="space-y-3">
      {pending.length === 0 && <div className="card"><p className="text-sm text-ink-light">No pending requests.</p></div>}
      {pending.map((b) => <ApprovalRow key={b.bookingId} b={b} caregivers={caregivers} onChange={onChange} />)}
    </div>
  );
}

function ApprovalRow({ b, caregivers, onChange }: { b: Booking; caregivers: Caregiver[]; onChange: () => void }) {
  const [caregiverId, setCaregiverId] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: string) {
    setBusy(true);
    try { await apiPost("/api/bookings", { action, bookingId: b.bookingId, caregiverId }); onChange(); }
    finally { setBusy(false); }
  }
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-medium text-ink">{b.serviceName} <span className="text-ink-light">for {b.recipientName}</span></div>
          <div className="text-xs text-ink-light">{b.householdName} · {b.start ? new Date(b.start).toLocaleString() : ""}{b.notes ? ` · ${b.notes}` : ""}</div>
          {b.credential !== "none" && <div className="mt-1 text-xs font-semibold text-gold-dark">Requires: {b.credential.toUpperCase()}</div>}
        </div>
        <div className="flex items-center gap-2">
          <select className="field !w-auto" value={caregiverId} onChange={(e) => setCaregiverId(e.target.value)}>
            <option value="">Assign caregiver…</option>
            {caregivers.map((c) => <option key={c.userId} value={c.userId}>{c.name || c.email}{c.credentials ? ` (${c.credentials})` : ""}</option>)}
          </select>
          <button onClick={() => act("approve")} disabled={busy} className="btn-primary">Approve</button>
          <button onClick={() => act("decline")} disabled={busy} className="btn-ghost">Decline</button>
        </div>
      </div>
    </div>
  );
}

function Clients({ clients }: { clients: Client[] }) {
  return (
    <div className="space-y-3">
      {clients.length === 0 && <div className="card"><p className="text-sm text-ink-light">No client households yet.</p></div>}
      {clients.map((c) => (
        <div key={c.householdId} className="card">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium text-ink">{c.name}</div>
            <div className="text-xs text-ink-light">{c.city}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.recipients.map((r) => (
              <span key={r.recipientId} className="rounded-md bg-brand-light px-2 py-1 text-xs text-brand">{r.name} · {r.type}</span>
            ))}
            {c.recipients.length === 0 && <span className="text-xs text-ink-light">No profiles yet</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Staff({ caregivers }: { caregivers: Caregiver[] }) {
  return (
    <div className="space-y-2">
      {caregivers.length === 0 && <div className="card"><p className="text-sm text-ink-light">No caregivers have signed up yet.</p></div>}
      {caregivers.map((c) => (
        <div key={c.userId} className="card flex items-center justify-between">
          <div>
            <div className="font-medium text-ink">{c.name || c.email}</div>
            <div className="text-xs text-ink-light">{c.email}{c.phone ? ` · ${c.phone}` : ""}{c.credentials ? ` · ${c.credentials}` : ""}</div>
          </div>
          <span className="rounded-md bg-brand-light px-2 py-1 text-xs font-semibold capitalize text-brand">{c.status}</span>
        </div>
      ))}
    </div>
  );
}

function Schedule({ shifts }: { shifts: Shift[] }) {
  if (shifts.length === 0) return <div className="card"><p className="text-sm text-ink-light">No shifts scheduled yet. Approve a booking to create one.</p></div>;
  // Group by calendar day.
  const groups: Record<string, Shift[]> = {};
  for (const s of shifts) {
    const day = s.start ? new Date(s.start).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "Unscheduled";
    (groups[day] ||= []).push(s);
  }
  const statusColor: Record<string, string> = {
    scheduled: "bg-brand-light text-brand", in_progress: "bg-gold/20 text-gold-dark",
    completed: "bg-ok/15 text-ok", open: "bg-rule text-ink-mid",
  };
  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([day, list]) => (
        <div key={day}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-light">{day}</h3>
          <div className="space-y-2">
            {list.map((s) => (
              <div key={s.shiftId} className="card flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-ink">{s.serviceName} <span className="text-ink-light">for {s.recipientName}</span></div>
                  <div className="text-xs text-ink-light">
                    {s.start ? new Date(s.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
                    {" · "}{s.caregiverName || "Unassigned"}{s.householdName ? ` · ${s.householdName}` : ""}
                  </div>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusColor[s.status] || "bg-brand-light text-brand"}`}>{s.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Services({ services, onChange }: { services: Service[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function seed() {
    setBusy(true);
    try { await apiPost("/api/services", { action: "seed" }); onChange(); } finally { setBusy(false); }
  }
  if (services.length === 0) {
    return (
      <div className="card text-center">
        <p className="mb-4 text-sm text-ink-mid">No services yet. Load the full Care Royal catalog (63 services across 10 categories) and edit rates from there.</p>
        <button onClick={seed} disabled={busy} className="btn-primary">{busy ? "Loading…" : "Load default catalog"}</button>
      </div>
    );
  }
  const byCat: Record<string, Service[]> = {};
  for (const s of services) (byCat[s.category] ||= []).push(s);
  return (
    <div className="space-y-6">
      {Object.entries(byCat).map(([cat, list]) => (
        <div key={cat} className="card">
          <h3 className="mb-3 font-serif text-lg text-ink">{cat}</h3>
          <div className="space-y-2">
            {list.map((s) => <ServiceRow key={s.serviceId} s={s} onChange={onChange} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServiceRow({ s, onChange }: { s: Service; onChange: () => void }) {
  const [rate, setRate] = useState(s.rate);
  const [active, setActive] = useState(s.active !== "false");
  const [dirty, setDirty] = useState(false);
  async function save() {
    await apiPost("/api/services", { action: "update", serviceId: s.serviceId, rate, active: String(active) });
    setDirty(false); onChange();
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-2 last:border-0">
      <div className="min-w-[12rem] flex-1">
        <div className="text-sm font-medium text-ink">{s.name}</div>
        <div className="text-xs text-ink-light">{s.profileType} · {s.pricingModel}{s.credential !== "none" ? ` · ${s.credential.toUpperCase()}` : ""}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-ink-mid">$
          <input className="field !w-20 !py-1" value={rate} onChange={(e) => { setRate(e.target.value); setDirty(true); }} placeholder="rate" />
          <span className="text-xs text-ink-light">/{s.pricingModel}</span>
        </div>
        <label className="flex items-center gap-1 text-xs text-ink-mid">
          <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); setDirty(true); }} /> Active
        </label>
        {dirty && <button onClick={save} className="btn-primary !px-3 !py-1 text-xs">Save</button>}
      </div>
    </div>
  );
}

interface Invoice { invoiceId: string; amount: string; status: string; serviceName: string; recipientName: string; householdName: string; createdAt: string }
interface PayRow { userId: string; name: string; shifts: number; hours: number; gross: number }

function Money() {
  const [connect, setConnect] = useState<{ connected: boolean; chargesEnabled?: boolean } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pay, setPay] = useState<{ rows: PayRow[]; total: number; backboneReady: boolean }>({ rows: [], total: 0, backboneReady: false });
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const [c, inv, pr] = await Promise.all([
      apiPost("/api/connect", { action: "status" }).catch(() => ({ connected: false })),
      apiGet("/api/invoices").catch(() => ({ invoices: [] })),
      apiGet("/api/payroll").catch(() => ({ rows: [], total: 0, backboneReady: false })),
    ]);
    setConnect(c); setInvoices(inv.invoices || []);
    setPay({ rows: pr.rows || [], total: pr.total || 0, backboneReady: !!pr.backboneReady });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onboard() {
    setBusy("connect");
    try { const d = await apiPost("/api/connect", { action: "onboard" }); if (d.url) window.location.href = d.url; else { setNote("Payments connected (demo)."); load(); } }
    catch (e) { setNote(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  }
  async function generate() {
    setBusy("gen");
    try { const d = await apiPost("/api/invoices", { action: "generate" }); setNote(`Generated ${d.created} invoice(s).`); load(); }
    finally { setBusy(""); }
  }
  async function invAction(invoiceId: string, action: string) {
    await apiPost("/api/invoices", { action, invoiceId }); load();
  }
  async function runPayroll() {
    setBusy("run");
    try { const d = await apiPost("/api/payroll", { action: "run" }); setNote(d.note || (d.ok ? "Payroll run." : "")); }
    finally { setBusy(""); }
  }

  const statusColor: Record<string, string> = {
    unpaid: "bg-gold/20 text-gold-dark", paid: "bg-ok/15 text-ok", void: "bg-rule text-ink-mid",
  };

  return (
    <div className="space-y-6">
      {note && <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">{note}</p>}

      <div className="card">
        <h3 className="mb-2 font-serif text-lg text-ink">Payments</h3>
        {!connect?.connected ? (
          <>
            <p className="mb-3 text-sm text-ink-mid">Connect Stripe so families can pay in-app and you receive funds directly. You are the merchant of record.</p>
            <button onClick={onboard} disabled={busy === "connect"} className="btn-primary">{busy === "connect" ? "…" : "Connect payments"}</button>
          </>
        ) : (
          <p className="text-sm text-ok">Stripe connected{connect.chargesEnabled ? " — charges enabled." : " — finish onboarding to enable charges."}</p>
        )}
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink">Invoices</h3>
          <button onClick={generate} disabled={busy === "gen"} className="btn-ghost">{busy === "gen" ? "…" : "Generate from completed shifts"}</button>
        </div>
        {invoices.length === 0 && <p className="text-sm text-ink-light">No invoices yet.</p>}
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.invoiceId} className="flex items-center justify-between border-b border-rule pb-2 text-sm last:border-0">
              <div>
                <div className="text-ink">${inv.amount} <span className="text-ink-light">— {inv.serviceName} for {inv.recipientName} ({inv.householdName})</span></div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusColor[inv.status] || ""}`}>{inv.status}</span>
                {inv.status === "unpaid" && (
                  <>
                    <button onClick={() => invAction(inv.invoiceId, "mark_paid")} className="text-xs font-semibold text-ok">Mark paid</button>
                    <button onClick={() => invAction(inv.invoiceId, "void")} className="text-xs font-semibold text-ink-light">Void</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink">Payroll</h3>
          <button onClick={runPayroll} disabled={busy === "run"} className="btn-primary">{busy === "run" ? "…" : "Run payroll"}</button>
        </div>
        {pay.rows.length === 0 && <p className="text-sm text-ink-light">No completed shifts to pay yet.</p>}
        <div className="space-y-2">
          {pay.rows.map((r) => (
            <div key={r.userId} className="flex items-center justify-between border-b border-rule pb-2 text-sm last:border-0">
              <div className="text-ink">{r.name} <span className="text-ink-light">· {r.shifts} shifts · {r.hours}h</span></div>
              <div className="font-medium text-ink">${r.gross.toFixed(2)}</div>
            </div>
          ))}
        </div>
        {pay.rows.length > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-rule-dark pt-3 text-sm font-semibold text-ink">
            <span>Total gross</span><span>${pay.total.toFixed(2)}</span>
          </div>
        )}
        {!pay.backboneReady && <p className="mt-3 text-xs text-ink-light">Connect a payroll backbone (Check or Gusto Embedded) to issue payouts. Timesheets and gross pay are ready now.</p>}
      </div>
    </div>
  );
}

interface Doc { docId: string; title: string; templateLabel: string; status: string; householdName: string; signedBy: string; signedAt: string; createdAt: string }

const DOC_TEMPLATES = [
  { key: "service_agreement", label: "Service Agreement" },
  { key: "care_plan", label: "Care Plan" },
  { key: "consent", label: "Consent to Care" },
  { key: "hipaa", label: "HIPAA Acknowledgment" },
];

function AgencyDocs({ clients, onChange }: { clients: Client[]; onChange: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [householdId, setHouseholdId] = useState("");
  const [template, setTemplate] = useState("service_agreement");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await apiGet("/api/documents").catch(() => ({ documents: [] }));
    setDocs(d.documents || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!householdId) return;
    setBusy(true);
    try { await apiPost("/api/documents", { action: "create", template, householdId }); await load(); onChange(); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="font-serif text-lg text-ink">Send a document for signature</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Client household</label>
            <select className="field" value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>
              <option value="">Select household</option>
              {clients.map((c) => <option key={c.householdId} value={c.householdId}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Document</label>
            <select className="field" value={template} onChange={(e) => setTemplate(e.target.value)}>
              {DOC_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <button onClick={create} disabled={busy || !householdId} className="btn-primary">{busy ? "…" : "Send for signature"}</button>
      </div>

      <div className="space-y-2">
        {docs.length === 0 && <div className="card"><p className="text-sm text-ink-light">No documents yet.</p></div>}
        {docs.map((d) => (
          <div key={d.docId} className="card flex items-center justify-between">
            <div>
              <div className="font-medium text-ink">{d.title}<span className="text-ink-light"> — {d.householdName}</span></div>
              <div className="text-xs text-ink-light">{d.status === "signed" ? `Signed by ${d.signedBy} on ${d.signedAt ? new Date(d.signedAt).toLocaleDateString() : ""}` : "Awaiting signature"}</div>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${d.status === "signed" ? "bg-ok/15 text-ok" : "bg-gold/20 text-gold-dark"}`}>{d.status === "signed" ? "Signed" : "Pending"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Lead { leadId: string; name: string; email: string; phone: string; city: string; zip: string; stage: string }
const STAGES = ["new", "contacted", "consultation", "client", "lost"];

// Minimal CSV parser (handles quoted fields and commas/newlines within quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [grandTotal, setGrandTotal] = useState(0);
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (q) params.set("q", q);
    const d = await apiGet(`/api/leads?${params.toString()}`).catch(() => ({ leads: [], counts: {}, grandTotal: 0 }));
    setLeads(d.leads || []); setCounts(d.counts || {}); setGrandTotal(d.grandTotal || 0);
  }, [stage, q]);
  useEffect(() => { load(); }, [load]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { setImporting("No rows found."); return; }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const map = { name: idx(["name"]), email: idx(["email"]), phone: idx(["phone", "number", "tel"]), address: idx(["address", "street"]), city: idx(["city"]), zip: idx(["zip", "postal"]) };
    const objs = rows.slice(1).map((r) => ({
      name: map.name >= 0 ? r[map.name] : "", email: map.email >= 0 ? r[map.email] : "",
      phone: map.phone >= 0 ? r[map.phone] : "", address: map.address >= 0 ? r[map.address] : "",
      city: map.city >= 0 ? r[map.city] : "", zip: map.zip >= 0 ? r[map.zip] : "",
    }));
    let done = 0;
    for (let i = 0; i < objs.length; i += 500) {
      const batch = objs.slice(i, i + 500);
      setImporting(`Importing ${done}/${objs.length}…`);
      await apiPost("/api/leads", { action: "import", leads: batch });
      done += batch.length;
    }
    setImporting(`Imported ${done} leads.`);
    load();
    e.target.value = "";
  }

  async function setLeadStage(leadId: string, newStage: string) {
    await apiPost("/api/leads", { action: "update_stage", leadId, stage: newStage });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-ink">{grandTotal.toLocaleString()} leads in pipeline</div>
            <div className="text-xs text-ink-light">Import your inquiry CSV (name, email, phone, address, city, zip).</div>
          </div>
          <label className="btn-primary cursor-pointer">
            Import CSV
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
        </div>
        {importing && <p className="mt-3 text-sm text-brand">{importing}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setStage("")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${stage === "" ? "bg-brand text-white" : "bg-brand-light text-brand"}`}>All</button>
        {STAGES.map((s) => (
          <button key={s} onClick={() => setStage(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${stage === s ? "bg-brand text-white" : "bg-brand-light text-brand"}`}>
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>

      <input className="field" placeholder="Search name, email, city, zip…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="space-y-2">
        {leads.length === 0 && <div className="card"><p className="text-sm text-ink-light">No leads match.</p></div>}
        {leads.map((l) => (
          <div key={l.leadId} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-ink">{l.name || "(no name)"}</div>
              <div className="text-xs text-ink-light">{l.email}{l.phone ? ` · ${l.phone}` : ""}{l.city ? ` · ${l.city}` : ""}{l.zip ? ` ${l.zip}` : ""}</div>
            </div>
            <select className="field !w-auto !py-1 text-xs" value={l.stage} onChange={(e) => setLeadStage(l.leadId, e.target.value)}>
              {STAGES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
        ))}
      </div>
      {leads.length >= 50 && <p className="text-center text-xs text-ink-light">Showing first 50. Use search or stage filters to narrow.</p>}
    </div>
  );
}
