"use client";
import { useCallback, useEffect, useState } from "react";
import PortalShell, { type NavItem, type NotifItem } from "../../components/PortalShell";
import CalendarView from "../../components/CalendarView";
import MessagesPanel from "../../components/MessagesPanel";
import Drawer from "../../components/Drawer";
import Icon from "../../components/Icon";
import { BarChart, Donut } from "../../components/Charts";
import { printDoc } from "../../components/DocumentsPanel";
import DocStudio from "../../components/DocStudio";
import { apiGet, apiPost } from "../lib/session";

const nav: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "schedule", label: "Schedule", icon: "schedule" },
  { key: "clients", label: "Clients", icon: "clients" },
  { key: "staff", label: "Staff", icon: "staff" },
  { key: "services", label: "Services", icon: "services" },
  { key: "messages", label: "Messages", icon: "messages" },
  { key: "money", label: "Money", icon: "money" },
  { key: "documents", label: "Documents", icon: "documents" },
  { key: "leads", label: "Leads", icon: "leads" },
  { key: "recruiting", label: "Recruiting", icon: "staff" },
  { key: "reports", label: "Reports", icon: "spark" },
  { key: "activity", label: "Activity", icon: "clock" },
];

const SECTION_INTRO: Record<string, string> = {
  dashboard: "Your agency at a glance — what needs attention today.",
  schedule: "Every booking on one calendar. Click any booking to approve, assign a caregiver, reschedule or cancel.",
  clients: "The households you serve and the people, pets and homes under their care.",
  staff: "Your caregivers. Share your agency code so they can join and see their shifts.",
  services: "Your service menu and rates. Families can only book what you switch on here.",
  messages: "One shared thread per client between your office, the family and the caregiver.",
  money: "Connect payments, generate invoices from completed shifts, and run payroll from the same timesheets.",
  documents: "Send care plans, agreements and consents for in-app signature with a full audit trail.",
  leads: "Your inquiry pipeline. Import a CSV and move each lead from new to client.",
  recruiting: "Caregiver applications from your public hiring page. Accept to add them to your roster.",
  reports: "How your agency is trending — bookings, revenue, utilization, margin and lead conversion.",
  activity: "A running audit log of what's happened across your agency.",
};

interface Service { serviceId: string; category: string; name: string; profileType: string; pricingModel: string; rate: string; credential: string; active: string }
interface Caregiver { userId: string; name: string; email: string; phone: string; credentials: string; status: string; availability?: string; credentialExpiry?: string; rate?: string }
interface Recipient { recipientId: string; name: string; type: string; conditions: string }
interface Client { householdId: string; name: string; city: string; recipients: Recipient[]; primaryCaregiverId?: string }
interface Booking { bookingId: string; status: string; start: string; end?: string; serviceName: string; recipientName: string; householdName: string; credential: string; notes: string; caregiverId: string }
interface Shift { shiftId: string; status: string; start: string; caregiverId: string; serviceName: string; recipientName: string; householdName: string; caregiverName: string; clockIn: string; clockOut: string; notes: string }
interface Tenant { name: string; plan: string; joinCode: string }

export default function AgencyPortal() {
  const [active, setActive] = useState("dashboard");
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [invoices, setInvoices] = useState<{ amount: string; status: string; createdAt: string }[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [quoteReqs, setQuoteReqs] = useState(0);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [s, a, b, sh, inv, t, ld, qr] = await Promise.all([
      apiGet("/api/services").catch(() => ({ services: [] })),
      apiGet("/api/agency").catch(() => ({ clients: [], caregivers: [] })),
      apiGet("/api/bookings").catch(() => ({ bookings: [] })),
      apiGet("/api/shifts").catch(() => ({ shifts: [] })),
      apiGet("/api/invoices").catch(() => ({ invoices: [] })),
      apiGet("/api/tenant").catch(() => ({ tenant: null })),
      apiGet("/api/leads").catch(() => ({ grandTotal: 0 })),
      apiGet("/api/quote-requests").catch(() => ({ requests: [] })),
    ]);
    setQuoteReqs((qr.requests || []).filter((r: Record<string, string>) => r.status === "new").length);
    setServices(s.services || []);
    setClients(a.clients || []); setCaregivers(a.caregivers || []);
    setBookings(b.bookings || []);
    setShifts(sh.shifts || []);
    setInvoices(inv.invoices || []);
    setTenant(t.tenant || null);
    setLeadCount(ld.grandTotal || 0);
    setLeadCounts(ld.counts || {});
  }, []);
  useEffect(() => { load(); }, [load]);
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3000); }

  const pending = bookings.filter((b) => b.status === "requested");
  const unassigned = shifts.filter((s) => s.status === "open");
  const notifications: NotifItem[] = [
    ...(quoteReqs > 0 ? [{ text: `${quoteReqs} new quote request${quoteReqs === 1 ? "" : "s"}`, sub: "Review in Leads", tone: "ok" as const }] : []),
    ...pending.map((b) => ({ text: `Booking request: ${b.serviceName}`, sub: `${b.recipientName} · ${b.householdName}`, tone: "gold" as const })),
    ...unassigned.map((s) => ({ text: `Unassigned shift: ${s.serviceName}`, sub: s.start ? fmtDate(s.start) : "", tone: "brand" as const })),
  ].slice(0, 12);

  return (
    <PortalShell title="Agency console" allow={["agency_admin", "agency_coord"]} nav={nav} active={active} onNav={setActive} notifications={notifications}>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">{nav.find((n) => n.key === active)?.label}</h1>
        <p className="mt-1 text-sm text-ink-light">{SECTION_INTRO[active]}</p>
      </div>
      {msg && <p className="mb-4 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}

      {active === "dashboard" && <Dashboard tenant={tenant} services={services} bookings={bookings} shifts={shifts} invoices={invoices} clients={clients} caregivers={caregivers} leadCount={leadCount} onGo={setActive} />}
      {active === "schedule" && <Schedule bookings={bookings} caregivers={caregivers} shifts={shifts} onChange={() => { load(); flash("Schedule updated."); }} />}
      {active === "clients" && <Clients clients={clients} caregivers={caregivers} joinCode={tenant?.joinCode} onChange={() => { load(); flash("Client updated."); }} />}
      {active === "staff" && <Staff caregivers={caregivers} joinCode={tenant?.joinCode} onChange={() => { load(); flash("Caregiver updated."); }} />}
      {active === "services" && <Services services={services} onChange={() => { load(); flash("Catalog updated."); }} />}
      {active === "messages" && <MessagesPanel />}
      {active === "money" && <Money onGo={setActive} plan={tenant?.plan} />}
      {active === "documents" && <AgencyDocs clients={clients} tenant={tenant} caregivers={caregivers} onChange={() => flash("Document sent.")} />}
      {active === "leads" && <Leads />}
      {active === "recruiting" && <Recruiting joinCode={tenant?.joinCode} onChange={load} />}
      {active === "reports" && <Reports bookings={bookings} shifts={shifts} invoices={invoices} caregivers={caregivers} leadCounts={leadCounts} />}
      {active === "activity" && <Activity />}
    </PortalShell>
  );
}

// ---------------------------------------------------------------- helpers
const fmtTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); };
const toLocalInput = (iso: string) => { const d = new Date(iso); if (isNaN(d.getTime())) return ""; const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); };
const statusTone: Record<string, "brand" | "gold" | "ok" | "danger"> = { requested: "gold", scheduled: "brand", in_progress: "gold", completed: "ok", declined: "danger", cancelled: "danger" };
const statusBadge: Record<string, string> = { requested: "badge-warn", scheduled: "badge-brand", in_progress: "badge-gold", completed: "badge-ok", declined: "badge-danger", cancelled: "badge-muted" };

// ---------------------------------------------------------------- share code
function ShareCode({ joinCode }: { joinCode?: string }) {
  const [copied, setCopied] = useState("");
  if (!joinCode) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links = [
    { label: "Public page", url: `${origin}/care/?a=${joinCode}` },
    { label: "Request-a-quote link", url: `${origin}/quote/?a=${joinCode}` },
    { label: "Hiring link", url: `${origin}/apply/?a=${joinCode}` },
  ];
  function copy(text: string, key: string) { navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(""), 1800); }); }
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg text-ink">Grow your agency</h3>
          <p className="mt-1 text-sm text-ink-light">Caregivers and families enter this code to join, or use the shareable links below.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border-2 border-dashed border-brand/40 bg-brand-light px-4 py-2 font-mono text-xl font-bold tracking-[0.3em] text-brand">{joinCode}</span>
          <button onClick={() => copy(joinCode!, "code")} className="btn-soft">{copied === "code" ? "Copied" : "Copy"}</button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {links.map((l) => (
          <button key={l.label} onClick={() => copy(l.url, l.label)} className="rounded-lg border border-rule px-3 py-2 text-left text-xs transition hover:border-brand/40">
            <span className="block font-semibold text-ink">{l.label}</span>
            <span className="block truncate text-ink-light">{copied === l.label ? "Copied to clipboard" : l.url.replace(/^https?:\/\//, "")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- dashboard
function Dashboard({ tenant, services, bookings, shifts, invoices, clients, caregivers, leadCount, onGo }: {
  tenant: Tenant | null; services: Service[]; bookings: Booking[]; shifts: Shift[];
  invoices: { amount: string; status: string; createdAt: string }[];
  clients: Client[]; caregivers: Caregiver[]; leadCount: number; onGo: (k: string) => void;
}) {
  const now = new Date();
  const sameDay = (iso: string) => { const d = new Date(iso); return !isNaN(d.getTime()) && d.toDateString() === now.toDateString(); };
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const pending = bookings.filter((b) => b.status === "requested");
  const clockedIn = shifts.filter((s) => s.clockIn && !s.clockOut);
  const todays = shifts.filter((s) => sameDay(s.start)).sort((a, b) => a.start.localeCompare(b.start));
  const revenue = invoices.filter((i) => i.status === "paid" && new Date(i.createdAt) >= weekAgo).reduce((t, i) => t + (parseFloat(i.amount) || 0), 0);
  const outstanding = invoices.filter((i) => i.status === "unpaid").reduce((t, i) => t + (parseFloat(i.amount) || 0), 0);

  const steps = [
    { done: services.some((s) => s.rate), label: "Set your service rates", hint: "Turn on the services you offer and price them.", go: "services" },
    { done: caregivers.length > 0, label: "Invite your caregivers", hint: "Share your agency code so staff can join.", go: "staff" },
    { done: clients.length > 0, label: "Add your first client", hint: "A family household with the people they care for.", go: "clients" },
    { done: bookings.some((b) => b.status !== "requested" && b.status !== "declined"), label: "Schedule a booking", hint: "Approve a request and assign a caregiver.", go: "schedule" },
  ];
  const remaining = steps.filter((s) => !s.done);

  const Stat = ({ label, val, go, tone = "brand" }: { label: string; val: string; go: string; tone?: string }) => (
    <button onClick={() => onGo(go)} className="card card-hover text-left">
      <div className={`text-3xl font-semibold ${tone === "ok" ? "text-ok" : tone === "gold" ? "text-gold-dark" : "text-brand"}`}>{val}</div>
      <div className="mt-1 text-sm text-ink-mid">{label}</div>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card hero-gradient !border-0 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">{tenant?.plan ? `${tenant.plan} plan` : "Welcome"}</p>
        <h2 className="mt-1 font-serif text-3xl">{tenant?.name || "Your agency"}</h2>
        <p className="mt-2 max-w-xl text-sm text-white/80">Approve bookings, keep your calendar full, sign care documents, and pay your team — all in one place.</p>
      </div>

      {/* Getting started */}
      {remaining.length > 0 && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">Getting started</h3>
            <span className="badge-brand">{steps.length - remaining.length}/{steps.length} done</span>
          </div>
          <div className="space-y-2">
            {steps.map((s) => (
              <button key={s.label} onClick={() => onGo(s.go)} className="flex w-full items-center gap-3 rounded-lg border border-rule px-3 py-2.5 text-left transition hover:border-brand/40">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${s.done ? "bg-ok text-white" : "border-2 border-rule-dark text-transparent"}`}><Icon name="check" size={14} /></span>
                <span className="flex-1">
                  <span className={`block text-sm font-medium ${s.done ? "text-ink-light line-through" : "text-ink"}`}>{s.label}</span>
                  {!s.done && <span className="block text-xs text-ink-light">{s.hint}</span>}
                </span>
                {!s.done && <Icon name="chevron" size={16} className="text-ink-light" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <ShareCode joinCode={tenant?.joinCode} />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending approvals" val={String(pending.length)} go="schedule" tone={pending.length ? "gold" : "brand"} />
        <Stat label="Clocked in now" val={String(clockedIn.length)} go="schedule" tone="ok" />
        <Stat label="Today's shifts" val={String(todays.length)} go="schedule" />
        <Stat label="Revenue this week" val={"$" + revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} go="money" tone="ok" />
        <Stat label="Active caregivers" val={String(caregivers.length)} go="staff" />
        <Stat label="Client households" val={String(clients.length)} go="clients" />
        <Stat label="Outstanding invoices" val={"$" + outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })} go="money" tone={outstanding ? "gold" : "brand"} />
        <Stat label="Leads in pipeline" val={leadCount.toLocaleString()} go="leads" />
      </div>

      {pending.length > 0 && (
        <div className="card flex items-center justify-between border-gold/40 bg-gold/5">
          <div className="text-sm"><b className="text-ink">{pending.length}</b> <span className="text-ink-mid">booking {pending.length === 1 ? "request" : "requests"} waiting for your approval</span></div>
          <button onClick={() => onGo("schedule")} className="btn-primary btn-sm">Review now</button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-serif text-lg text-ink">Clocked in now</h3>
          {clockedIn.length === 0 ? <p className="text-sm text-ink-light">No one is clocked in right now.</p> : (
            <ul className="space-y-3">
              {clockedIn.map((s) => (
                <li key={s.shiftId} className="flex items-center gap-3 text-sm">
                  <span className="stat-dot bg-ok animate-pulse" />
                  <span><b className="text-ink">{s.caregiverName || "Caregiver"}</b> <span className="text-ink-mid">· {s.recipientName || "client"} · {s.serviceName}</span></span>
                  <span className="ml-auto text-xs text-ink-light">since {fmtTime(s.clockIn)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 className="mb-3 font-serif text-lg text-ink">Today&apos;s schedule</h3>
          {todays.length === 0 ? <p className="text-sm text-ink-light">Nothing scheduled today.</p> : (
            <ul className="space-y-3">
              {todays.map((s) => (
                <li key={s.shiftId} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 tabular-nums text-ink-mid">{fmtTime(s.start)}</span>
                  <span><b className="text-ink">{s.serviceName}</b> <span className="text-ink-mid">· {s.recipientName || "client"} · {s.caregiverName || "Unassigned"}</span></span>
                  <span className={`ml-auto shrink-0 ${statusBadge[s.status] || "badge-brand"}`}>{s.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- schedule (merged calendar + bookings + approvals)
function Schedule({ bookings, caregivers, shifts, onChange }: { bookings: Booking[]; caregivers: Caregiver[]; shifts: Shift[]; onChange: () => void }) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selId, setSelId] = useState<string | null>(null);
  const pending = bookings.filter((b) => b.status === "requested");
  const live = bookings.filter((b) => b.status !== "declined" && b.status !== "cancelled");
  const selected = bookings.find((b) => b.bookingId === selId) || null;

  const events = live.filter((b) => b.start).map((b) => ({ id: b.bookingId, date: b.start, label: b.serviceName, sub: b.recipientName, tone: statusTone[b.status] || "brand" }));

  // list grouped by day
  const groups: Record<string, Booking[]> = {};
  for (const b of live.slice().sort((a, b) => a.start.localeCompare(b.start))) {
    const day = b.start ? fmtDate(b.start) : "Unscheduled";
    (groups[day] ||= []).push(b);
  }

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="card border-gold/40 bg-gold/5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">{pending.length} request{pending.length === 1 ? "" : "s"} to review</h3>
          </div>
          <div className="space-y-2">
            {pending.map((b) => (
              <button key={b.bookingId} onClick={() => setSelId(b.bookingId)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-rule bg-white px-3 py-2.5 text-left transition hover:border-brand/40">
                <span>
                  <span className="block text-sm font-medium text-ink">{b.serviceName} <span className="text-ink-light">for {b.recipientName}</span></span>
                  <span className="block text-xs text-ink-light">{b.householdName}{b.start ? ` · ${fmtDate(b.start)} ${fmtTime(b.start)}` : ""}</span>
                </span>
                <span className="badge-warn">Review</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="inline-flex rounded-lg border border-rule bg-white p-1">
        <button onClick={() => setView("calendar")} className={view === "calendar" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>Calendar</button>
        <button onClick={() => setView("list")} className={view === "list" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>List</button>
      </div>

      {view === "calendar" ? (
        <CalendarView events={events} onSelect={setSelId} />
      ) : (
        <div className="space-y-6">
          {Object.keys(groups).length === 0 && <div className="card"><p className="text-sm text-ink-light">No bookings yet. When a family requests care it appears here for approval.</p></div>}
          {Object.entries(groups).map(([day, list]) => (
            <div key={day}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-light">{day}</h3>
              <div className="space-y-2">
                {list.map((b) => (
                  <button key={b.bookingId} onClick={() => setSelId(b.bookingId)} className="card card-hover flex w-full items-center justify-between gap-3 text-left">
                    <div>
                      <div className="text-sm font-medium text-ink">{b.serviceName} <span className="text-ink-light">for {b.recipientName}</span></div>
                      <div className="text-xs text-ink-light">{fmtTime(b.start)} · {caregivers.find((c) => c.userId === b.caregiverId)?.name || "Unassigned"}{b.householdName ? ` · ${b.householdName}` : ""}</div>
                    </div>
                    <span className={statusBadge[b.status] || "badge-brand"}>{b.status.replace("_", " ")}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <BookingDrawer booking={selected} caregivers={caregivers} shifts={shifts} onClose={() => setSelId(null)} onChange={() => { setSelId(null); onChange(); }} />
    </div>
  );
}

// Warn if the chosen caregiver already has a shift within ±2h, or the time is
// outside the availability they set.
function scheduleWarnings(caregiver: Caregiver | undefined, whenIso: string, shifts: Shift[], bookingId: string): string[] {
  if (!caregiver || !whenIso) return [];
  const w: string[] = [];
  const t = new Date(whenIso).getTime();
  const clash = shifts.find((s) => s.caregiverId === caregiver.userId && (s.status === "scheduled" || s.status === "in_progress") && s.start && Math.abs(new Date(s.start).getTime() - t) < 2 * 3600e3);
  if (clash) w.push(`${caregiver.name || "This caregiver"} already has a shift near this time (${fmtDate(clash.start)} ${fmtTime(clash.start)}).`);
  try {
    const a = caregiver.availability ? JSON.parse(caregiver.availability) : null;
    if (a && Array.isArray(a.days)) {
      const d = new Date(whenIso);
      const hm = d.toTimeString().slice(0, 5);
      if (!a.days.includes(d.getDay())) w.push(`${caregiver.name || "This caregiver"} isn't available on ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}s.`);
      else if (a.from && a.to && (hm < a.from || hm > a.to)) w.push(`Outside their stated hours (${a.from}–${a.to}).`);
    }
  } catch { /* ignore */ }
  return w;
}

function BookingDrawer({ booking, caregivers, shifts, onClose, onChange }: { booking: Booking | null; caregivers: Caregiver[]; shifts: Shift[]; onClose: () => void; onChange: () => void }) {
  const [caregiverId, setCaregiverId] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (booking) { setCaregiverId(booking.caregiverId || ""); setWhen(toLocalInput(booking.start)); } }, [booking]);
  if (!booking) return null;
  const warnings = scheduleWarnings(caregivers.find((c) => c.userId === caregiverId), when ? new Date(when).toISOString() : "", shifts, booking.bookingId);

  function suggestBest(): string {
    const t = when ? new Date(when) : null;
    const scored = caregivers.map((c) => {
      let score = 0;
      try { const a = c.availability ? JSON.parse(c.availability) : null; if (a && Array.isArray(a.days) && t) score += a.days.includes(t.getDay()) ? 2 : -1; } catch { /* */ }
      if (t) { const clash = shifts.find((s) => s.caregiverId === c.userId && (s.status === "scheduled" || s.status === "in_progress") && s.start && Math.abs(new Date(s.start).getTime() - t.getTime()) < 2 * 3600e3); score += clash ? -3 : 1; }
      if (booking && (booking.credential && booking.credential !== "none") && (c.credentials || "")) score += 1;
      return { id: c.userId, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.id || "";
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try { await apiPost("/api/bookings", { action, bookingId: booking!.bookingId, ...extra }); onChange(); }
    finally { setBusy(false); }
  }
  const isRequested = booking.status === "requested";
  const canManage = booking.status === "scheduled" || booking.status === "requested";

  return (
    <Drawer open={!!booking} onClose={onClose} title={booking.serviceName || "Booking"}>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <span className={statusBadge[booking.status] || "badge-brand"}>{booking.status.replace("_", " ")}</span>
          {booking.credential && booking.credential !== "none" && <span className="badge-gold">Requires {booking.credential.toUpperCase()}</span>}
        </div>

        <dl className="space-y-2 text-sm">
          <Row k="Care recipient" v={booking.recipientName} />
          <Row k="Household" v={booking.householdName} />
          <Row k="When" v={booking.start ? `${fmtDate(booking.start)} at ${fmtTime(booking.start)}` : "Not set"} />
          <Row k="Caregiver" v={caregivers.find((c) => c.userId === booking.caregiverId)?.name || "Unassigned"} />
          {booking.notes && <Row k="Notes" v={booking.notes} />}
        </dl>

        {canManage && (
          <div className="space-y-4 border-t border-rule pt-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Assign caregiver</label>
                {caregivers.length > 0 && <button type="button" onClick={() => setCaregiverId(suggestBest())} className="text-xs font-semibold text-brand hover:underline">Suggest best match</button>}
              </div>
              <select className="field" value={caregiverId} onChange={(e) => setCaregiverId(e.target.value)}>
                <option value="">Unassigned</option>
                {caregivers.map((c) => <option key={c.userId} value={c.userId}>{c.name || c.email}{c.credentials ? ` (${c.credentials})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date & time</label>
              <input type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            {warnings.length > 0 && (
              <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold-dark">
                {warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {isRequested ? (
          <>
            <button onClick={() => act("approve", { caregiverId })} disabled={busy} className="btn-primary flex-1">Approve</button>
            <button onClick={() => act("decline")} disabled={busy} className="btn-ghost">Decline</button>
          </>
        ) : booking.status === "scheduled" ? (
          <>
            <button onClick={() => act("assign", { caregiverId })} disabled={busy} className="btn-primary flex-1">Save caregiver</button>
            {when && when !== toLocalInput(booking.start) && <button onClick={() => act("reschedule", { start: new Date(when).toISOString() })} disabled={busy} className="btn-soft">Reschedule</button>}
            <button onClick={() => act("cancel")} disabled={busy} className="btn-danger">Cancel</button>
          </>
        ) : (
          <p className="text-sm text-ink-light">This booking is {booking.status}. No further action needed.</p>
        )}
      </div>
    </Drawer>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="shrink-0 text-ink-light">{k}</dt><dd className="text-right font-medium text-ink">{v}</dd></div>;
}

// ---------------------------------------------------------------- reports
function Reports({ bookings, shifts, invoices, caregivers, leadCounts }: {
  bookings: Booking[]; shifts: Shift[]; caregivers: Caregiver[];
  invoices: { amount: string; status: string; createdAt: string }[];
  leadCounts: Record<string, number>;
}) {
  const shiftHours = (s: Shift) => (s.clockIn && s.clockOut ? Math.max(0, (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / 3600000) : 0);
  const collected = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
  const outstanding = invoices.filter((i) => i.status === "unpaid").reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
  const completed = shifts.filter((s) => s.status === "completed");
  const totalHours = completed.reduce((a, s) => a + shiftHours(s), 0);
  const rates = caregivers.map((c) => parseFloat(c.rate || "0")).filter((r) => r > 0);
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const estLabor = totalHours * avgRate;
  const estMargin = collected - estLabor;
  const assignable = shifts.filter((s) => s.status !== "cancelled").length;
  const filled = shifts.filter((s) => s.status !== "open" && s.status !== "cancelled").length;
  const fillRate = assignable ? Math.round((filled / assignable) * 100) : 0;
  const now = Date.now();
  const bookingBars: { label: string; value: number; tone: string }[] = [];
  const revenueBars: { label: string; value: number; tone: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const hi = now - i * 7 * 864e5, lo = hi - 7 * 864e5;
    const label = new Date(lo).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const bk = bookings.filter((b) => { const t = new Date(b.start).getTime(); return t > lo && t <= hi; }).length;
    const rev = invoices.filter((inv) => inv.status === "paid" && (() => { const t = new Date(inv.createdAt).getTime(); return t > lo && t <= hi; })()).reduce((a, inv) => a + (parseFloat(inv.amount) || 0), 0);
    bookingBars.push({ label, value: bk, tone: "brand" });
    revenueBars.push({ label, value: Math.round(rev), tone: "ok" });
  }
  const hoursByCg: Record<string, number> = {};
  for (const s of shifts) if (s.clockIn && s.clockOut) { const h = Math.max(0, (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / 3600000); hoursByCg[s.caregiverName || "Unassigned"] = (hoursByCg[s.caregiverName || "Unassigned"] || 0) + h; }
  const cgBars = Object.entries(hoursByCg).map(([label, v]) => ({ label, value: Math.round(v * 10) / 10, tone: "purple" }));
  const stageTone: Record<string, string> = { new: "brand", contacted: "purple", consultation: "gold", client: "ok", lost: "danger" };
  const pipe = ["new", "contacted", "consultation", "client", "lost"].map((s) => ({ label: s, value: leadCounts[s] || 0, tone: stageTone[s] }));
  const converted = leadCounts.client || 0;
  const totalLeads = Object.values(leadCounts).reduce((a, b) => a + b, 0);

  const money = (n: number) => "$" + Math.round(n).toLocaleString();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card"><div className="text-2xl font-semibold text-ok">{money(collected)}</div><div className="mt-1 text-xs text-ink-light">Collected</div></div>
        <div className="card"><div className="text-2xl font-semibold text-gold-dark">{money(outstanding)}</div><div className="mt-1 text-xs text-ink-light">Outstanding</div></div>
        <div className="card"><div className="text-2xl font-semibold text-brand">{fillRate}%</div><div className="mt-1 text-xs text-ink-light">Shift fill rate</div></div>
        <div className="card"><div className="text-2xl font-semibold text-ink">{money(estMargin)}</div><div className="mt-1 text-xs text-ink-light">Est. margin{avgRate ? "" : " (set pay rates)"}</div></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card"><h3 className="mb-4 font-serif text-lg text-ink">Bookings — last 6 weeks</h3><BarChart data={bookingBars} /></div>
        <div className="card"><h3 className="mb-4 font-serif text-lg text-ink">Revenue collected — last 6 weeks</h3><BarChart data={revenueBars} prefix="$" /></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-serif text-lg text-ink">Caregiver hours</h3>
          {cgBars.length ? <BarChart data={cgBars} prefix="" /> : <p className="text-sm text-ink-light">No completed shifts yet.</p>}
        </div>
        <div className="card">
          <h3 className="mb-4 font-serif text-lg text-ink">Lead pipeline</h3>
          {totalLeads ? <><Donut segments={pipe} /><p className="mt-4 text-sm text-ink-mid">Conversion: <b className="text-ink">{totalLeads ? Math.round((converted / totalLeads) * 100) : 0}%</b> of {totalLeads.toLocaleString()} leads became clients.</p></> : <p className="text-sm text-ink-light">Import leads to see your pipeline.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- clients
function Clients({ clients, caregivers, joinCode, onChange }: { clients: Client[]; caregivers: Caregiver[]; joinCode?: string; onChange: () => void }) {
  async function assign(householdId: string, caregiverId: string) {
    await apiPost("/api/agency", { action: "assign_caregiver", householdId, caregiverId }); onChange();
  }
  return (
    <div className="space-y-4">
      <ShareCode joinCode={joinCode} />
      {clients.length === 0 && <div className="card"><p className="text-sm text-ink-light">No client households yet. Families join with your agency code, or you can add them after a consultation.</p></div>}
      {clients.map((c) => (
        <div key={c.householdId} className="card">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium text-ink">{c.name}</div>
            <div className="text-xs text-ink-light">{c.city}</div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {c.recipients.map((r) => (
              <span key={r.recipientId} className="badge-brand">{r.name} · {r.type}</span>
            ))}
            {c.recipients.length === 0 && <span className="text-xs text-ink-light">No care profiles yet</span>}
          </div>
          <div className="flex items-center gap-2 border-t border-rule pt-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-light">Primary caregiver</span>
            <select className="field field-sm !w-auto" value={c.primaryCaregiverId || ""} onChange={(e) => assign(c.householdId, e.target.value)}>
              <option value="">Unassigned</option>
              {caregivers.map((cg) => <option key={cg.userId} value={cg.userId}>{cg.name || cg.email}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- staff
function credentialState(expiry?: string): { tone: string; label: string } | null {
  if (!expiry) return null;
  const d = new Date(expiry); if (isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 864e5);
  if (days < 0) return { tone: "badge-danger", label: `Expired ${d.toLocaleDateString()}` };
  if (days <= 30) return { tone: "badge-warn", label: `Expires in ${days}d` };
  return { tone: "badge-ok", label: `Valid to ${d.toLocaleDateString()}` };
}

function Staff({ caregivers, joinCode, onChange }: { caregivers: Caregiver[]; joinCode?: string; onChange: () => void }) {
  const expiring = caregivers.filter((c) => { const s = credentialState(c.credentialExpiry); return s && s.tone !== "badge-ok"; });
  return (
    <div className="space-y-4">
      <ShareCode joinCode={joinCode} />
      {expiring.length > 0 && <div className="card border-gold/40 bg-gold/5 text-sm text-gold-dark">{expiring.length} caregiver credential{expiring.length === 1 ? "" : "s"} expired or expiring soon — update below.</div>}
      {caregivers.length === 0 && <div className="card"><p className="text-sm text-ink-light">No caregivers have joined yet. Share your hiring link — applicants appear under Recruiting, and once they sign up with your code they show here.</p></div>}
      {caregivers.map((c) => <StaffRow key={c.userId} c={c} onChange={onChange} />)}
    </div>
  );
}

function StaffRow({ c, onChange }: { c: Caregiver; onChange: () => void }) {
  const [edit, setEdit] = useState(false);
  const [cred, setCred] = useState(c.credentials || "");
  const [exp, setExp] = useState(c.credentialExpiry || "");
  const [rate, setRate] = useState(c.rate || "");
  const cs = credentialState(c.credentialExpiry);
  async function save() { await apiPost("/api/agency", { action: "set_caregiver", userId: c.userId, credentials: cred, credentialExpiry: exp, rate }); setEdit(false); onChange(); }
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-ink">{c.name || c.email}</div>
          <div className="text-xs text-ink-light">{c.email}{c.phone ? ` · ${c.phone}` : ""}{c.credentials ? ` · ${c.credentials}` : ""}{c.rate ? ` · $${c.rate}/hr` : ""}</div>
        </div>
        <div className="flex items-center gap-2">
          {cs && <span className={cs.tone}>{cs.label}</span>}
          <button onClick={() => setEdit((v) => !v)} className="btn-ghost btn-sm">{edit ? "Close" : "Edit"}</button>
        </div>
      </div>
      {edit && (
        <div className="mt-3 grid gap-3 border-t border-rule pt-3 sm:grid-cols-3">
          <div><label className="label">Credentials</label><input className="field field-sm" value={cred} onChange={(e) => setCred(e.target.value)} placeholder="CNA, CPR" /></div>
          <div><label className="label">Credential expiry</label><input type="date" className="field field-sm" value={exp} onChange={(e) => setExp(e.target.value)} /></div>
          <div><label className="label">Pay rate $/hr</label><input className="field field-sm" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <button onClick={save} className="btn-primary btn-sm sm:col-span-3 sm:w-auto">Save</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- recruiting
function Recruiting({ joinCode, onChange }: { joinCode?: string; onChange: () => void }) {
  const [apps, setApps] = useState<Record<string, string>[]>([]);
  const load = useCallback(async () => { const d = await apiGet("/api/applications").catch(() => ({ applications: [] })); setApps(d.applications || []); }, []);
  useEffect(() => { load(); }, [load]);
  async function act(id: string, action: string) { await apiPost("/api/applications", { action, appId: id }); load(); onChange(); }
  const open = apps.filter((a) => a.status === "new");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="space-y-4">
      {joinCode && <div className="card flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-serif text-lg text-ink">Your hiring page</h3><p className="mt-1 text-sm text-ink-light">Share this link to collect caregiver applications.</p></div><code className="rounded bg-paper px-3 py-2 text-xs text-ink-mid">{origin}/apply/?a={joinCode}</code></div>}
      {open.length === 0 && <div className="card"><p className="text-sm text-ink-light">No new applications. Share your hiring link to start receiving them.</p></div>}
      {open.map((a) => (
        <div key={a._id || a.appId} className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-medium text-ink">{a.name} <span className="text-ink-light">· {a.phone}{a.city ? ` · ${a.city}` : ""}</span></div>
              <div className="text-xs text-ink-light">{a.email}</div>
              <div className="mt-1 text-sm text-ink-mid">{a.credentials ? `${a.credentials} · ` : ""}{a.experience}</div>
              {a.services && <div className="mt-1 text-xs text-ink-light">Services: {a.services}</div>}
              {a.availability && <div className="text-xs text-ink-light">Available: {a.availability}</div>}
              {a.details && <div className="mt-1 text-xs text-ink-light">{a.details}</div>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => act(a._id || a.appId, "accept")} className="btn-primary btn-sm">Accept</button>
              <button onClick={() => act(a._id || a.appId, "decline")} className="btn-ghost btn-sm">Decline</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- activity
function Activity() {
  const [events, setEvents] = useState<Record<string, string>[]>([]);
  useEffect(() => { apiGet("/api/events").then((d) => setEvents(d.events || [])).catch(() => {}); }, []);
  return (
    <div className="card">
      {events.length === 0 && <p className="text-sm text-ink-light">No activity recorded yet.</p>}
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-1.5 stat-dot bg-brand" />
            <span className="flex-1"><span className="text-ink">{e.text}</span> <span className="text-ink-light">· {e.actor}</span></span>
            <span className="shrink-0 text-xs text-ink-light">{e.createdAt ? new Date(e.createdAt).toLocaleString() : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- services
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
          <input className="field field-sm !w-20" value={rate} onChange={(e) => { setRate(e.target.value); setDirty(true); }} placeholder="rate" />
          <span className="text-xs text-ink-light">/{s.pricingModel}</span>
        </div>
        <label className="flex items-center gap-1 text-xs text-ink-mid">
          <input type="checkbox" checked={active} onChange={(e) => { setActive(e.target.checked); setDirty(true); }} /> Active
        </label>
        {dirty && <button onClick={save} className="btn-primary btn-sm">Save</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- money
interface Invoice { invoiceId: string; amount: string; status: string; serviceName: string; recipientName: string; householdName: string; createdAt: string }
interface PayRow { userId: string; name: string; shifts: number; hours: number; gross: number }

function Money({ onGo, plan }: { onGo: (k: string) => void; plan?: string }) {
  const [connect, setConnect] = useState<{ connected: boolean; chargesEnabled?: boolean } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pay, setPay] = useState<{ rows: PayRow[]; total: number; backboneReady: boolean; provider?: string }>({ rows: [], total: 0, backboneReady: false });
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const [c, inv, pr] = await Promise.all([
      apiPost("/api/connect", { action: "status" }).catch(() => ({ connected: false })),
      apiGet("/api/invoices").catch(() => ({ invoices: [] })),
      apiGet("/api/payroll").catch(() => ({ rows: [], total: 0, backboneReady: false })),
    ]);
    setConnect(c); setInvoices(inv.invoices || []);
    setPay({ rows: pr.rows || [], total: pr.total || 0, backboneReady: !!pr.backboneReady, provider: pr.provider || "" });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function connectPayroll(provider: string) {
    setBusy("payroll");
    try { const d = await apiPost("/api/payroll", { action: "connect_payroll", provider }); if (d.url) window.location.href = d.url; else { setNote(provider === "gusto" ? "Payroll connected via Gusto." : "Care Royal Payroll enabled."); load(); } }
    catch (e) { setNote(e instanceof Error ? e.message : "Failed"); } finally { setBusy(""); }
  }

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

  return (
    <div className="space-y-6">
      {note && <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">{note}</p>}

      <div className="card flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg text-ink">Your Care Royal plan</h3>
          <p className="mt-1 text-sm text-ink-light">Billing for your Care Royal subscription is handled by Care Royal. You keep 100% of client payments minus card fees.</p>
        </div>
        <span className="badge-brand capitalize">{plan || "trial"}</span>
      </div>

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
          <button onClick={generate} disabled={busy === "gen"} className="btn-ghost btn-sm">{busy === "gen" ? "…" : "Generate from completed shifts"}</button>
        </div>
        {invoices.length === 0 && <p className="text-sm text-ink-light">No invoices yet.</p>}
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div key={inv.invoiceId} className="flex items-center justify-between border-b border-rule pb-2 text-sm last:border-0">
              <div>
                <div className="text-ink">${inv.amount} <span className="text-ink-light">— {inv.serviceName} for {inv.recipientName} ({inv.householdName})</span></div>
              </div>
              <div className="flex items-center gap-2">
                <span className={inv.status === "paid" ? "badge-ok" : inv.status === "void" ? "badge-muted" : "badge-warn"}>{inv.status}</span>
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
          {pay.backboneReady && <button onClick={runPayroll} disabled={busy === "run"} className="btn-primary btn-sm">{busy === "run" ? "…" : "Run payroll"}</button>}
        </div>
        {!pay.backboneReady ? (
          <div className="mb-4 space-y-3">
            <p className="text-sm text-ink-mid">Choose how you run payroll. Either way Care Royal never holds your funds — gross pay below comes from your timesheets.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-rule bg-paper p-4">
                <div className="font-medium text-ink">Care Royal Payroll</div>
                <p className="mt-1 text-xs text-ink-light">Generate branded paystubs, verification letters, invoices & receipts in-app — with real tax math. No external account.</p>
                <button onClick={() => connectPayroll("careroyal")} disabled={busy === "payroll"} className="btn-primary btn-sm mt-3">Use Care Royal Payroll</button>
              </div>
              <div className="rounded-lg border border-rule bg-paper p-4">
                <div className="font-medium text-ink">Connect Gusto</div>
                <p className="mt-1 text-xs text-ink-light">Bring your own Gusto account for full-service payroll, direct deposit and tax filing under your agency.</p>
                <button onClick={() => connectPayroll("gusto")} disabled={busy === "payroll"} className="btn-ghost btn-sm mt-3">Connect Gusto</button>
              </div>
            </div>
          </div>
        ) : pay.provider === "gusto" ? (
          <p className="mb-3 text-sm text-ok">Payroll connected via Gusto. Gross pay below syncs to your account.</p>
        ) : (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ok/10 px-3 py-2">
            <span className="text-sm text-ok">Care Royal Payroll is on. Create paystubs & pay documents in the Document Studio.</span>
            <button onClick={() => onGo("documents")} className="btn-soft btn-sm">Open Document Studio</button>
          </div>
        )}
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- documents
interface Doc { docId: string; template: string; templateLabel: string; title: string; content: string; status: string; signedBy: string; signedAt: string; signature?: string; householdName: string; recipientName: string; createdAt: string }

const DOC_TEMPLATES = [
  { key: "service_agreement", label: "Service Agreement" },
  { key: "care_plan", label: "Care Plan" },
  { key: "consent", label: "Consent to Care" },
  { key: "hipaa", label: "HIPAA Acknowledgment" },
];

function AgencyDocs({ clients, tenant, caregivers, onChange }: { clients: Client[]; tenant: Tenant | null; caregivers: Caregiver[]; onChange: () => void }) {
  const [view, setView] = useState<"requests" | "create">("requests");
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
      <div className="inline-flex rounded-lg border border-rule bg-white p-1">
        <button onClick={() => setView("requests")} className={view === "requests" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>Signature requests</button>
        <button onClick={() => setView("create")} className={view === "create" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>Create & download</button>
      </div>

      {view === "create" ? (
        <DocStudio tenantId={tenant?.joinCode ? tenant.joinCode : "demo"} tenantName={tenant?.name} caregivers={caregivers.map((c) => ({ userId: c.userId, name: c.name, email: c.email }))} />
      ) : (
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
            <div className="flex items-center gap-2">
              <button onClick={() => printDoc(d)} className="btn-ghost btn-sm">Download</button>
              <span className={d.status === "signed" ? "badge-ok" : "badge-warn"}>{d.status === "signed" ? "Signed" : "Pending"}</span>
            </div>
          </div>
        ))}
      </div>
      </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- leads
interface Lead { leadId: string; name: string; email: string; phone: string; city: string; zip: string; stage: string }
const STAGES = ["new", "contacted", "consultation", "client", "lost"];

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
  const [requests, setRequests] = useState<Record<string, string>[]>([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (q) params.set("q", q);
    const d = await apiGet(`/api/leads?${params.toString()}`).catch(() => ({ leads: [], counts: {}, grandTotal: 0 }));
    setLeads(d.leads || []); setCounts(d.counts || {}); setGrandTotal(d.grandTotal || 0);
  }, [stage, q]);
  const loadReq = useCallback(async () => {
    const d = await apiGet("/api/quote-requests").catch(() => ({ requests: [] }));
    setRequests((d.requests || []).filter((r: Record<string, string>) => r.status === "new"));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadReq(); }, [loadReq]);
  async function reqAct(id: string, action: string) { await apiPost("/api/quote-requests", { action, quoteId: id }); loadReq(); load(); }

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
      {requests.length > 0 && (
        <div className="card border-gold/40 bg-gold/5">
          <h3 className="mb-3 font-serif text-lg text-ink">{requests.length} new quote request{requests.length === 1 ? "" : "s"}</h3>
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r._id || r.quoteId} className="rounded-lg border border-rule bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-ink">{r.name || "(no name)"} <span className="text-ink-light">· {r.phone}{r.city ? ` · ${r.city}` : ""}</span></div>
                    <div className="mt-0.5 text-xs text-ink-light">{r.email}</div>
                    <div className="mt-1 text-sm text-ink-mid">Care for {r.recipientName || r.careFor}{r.services ? ` · ${r.services}` : ""}{r.frequency ? ` · ${r.frequency}` : ""}</div>
                    {r.details && <div className="mt-1 text-xs text-ink-light">{r.details}</div>}
                    {r.bestTime && <div className="mt-1 text-xs text-ink-light">Best time: {r.bestTime}</div>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => reqAct(r._id || r.quoteId, "convert")} className="btn-primary btn-sm">Add to pipeline</button>
                    <button onClick={() => reqAct(r._id || r.quoteId, "dismiss")} className="btn-ghost btn-sm">Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
        <button onClick={() => setStage("")} className={stage === "" ? "chip-on" : "chip-off"}>All</button>
        {STAGES.map((s) => (
          <button key={s} onClick={() => setStage(s)} className={`capitalize ${stage === s ? "chip-on" : "chip-off"}`}>
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
            <select className="field field-sm !w-auto" value={l.stage} onChange={(e) => setLeadStage(l.leadId, e.target.value)}>
              {STAGES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
        ))}
      </div>
      {leads.length >= 50 && <p className="text-center text-xs text-ink-light">Showing first 50. Use search or stage filters to narrow.</p>}
    </div>
  );
}
