"use client";
import { useCallback, useEffect, useState } from "react";
import PortalShell, { type NavItem } from "../../components/PortalShell";
import DocumentsPanel from "../../components/DocumentsPanel";
import CalendarView from "../../components/CalendarView";
import MessagesPanel from "../../components/MessagesPanel";
import Icon from "../../components/Icon";
import { apiGet, apiPost } from "../lib/session";

const nav: NavItem[] = [
  { key: "home", label: "Home", icon: "dashboard" },
  { key: "household", label: "My people", icon: "recipients" },
  { key: "bookings", label: "Bookings", icon: "book" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "messages", label: "Messages", icon: "messages" },
  { key: "payments", label: "Payments", icon: "money" },
  { key: "documents", label: "Documents", icon: "documents" },
];
const INTRO: Record<string, string> = {
  home: "Care for the people, pets and home you love — booked and managed in one place.",
  household: "The people, pets and homes you arrange care for.",
  bookings: "Request care for any profile. Your agency reviews and approves each booking.",
  calendar: "Every booking on one calendar.",
  messages: "Message your agency and caregiver about a visit.",
  payments: "Your invoices from the agency.",
  documents: "Care plans and agreements to review and sign.",
};

interface Household { householdId: string; name: string; address: string; city: string; zip: string }
interface Recipient { recipientId: string; name: string; type: string; dob: string; address: string; conditions: string; notes: string }
interface Service { serviceId: string; name: string; category: string; profileType: string; pricingModel: string; rate: string; credential: string; active: string }
interface Booking { bookingId: string; status: string; start: string; end: string; serviceName: string; recipientName: string; recipientType: string; notes: string }
interface Shift { shiftId: string; status: string; start: string; serviceName: string; recipientName: string; caregiverName: string; clockIn: string; notes: string }

const typeLabel: Record<string, string> = { person: "Person", pet: "Pet", home: "Home" };
const statusBadge: Record<string, string> = {
  requested: "badge-warn", scheduled: "badge-brand", declined: "badge-danger",
  completed: "badge-ok", cancelled: "badge-muted",
};

export default function FamilyPortal() {
  const [active, setActive] = useState("home");
  const [household, setHousehold] = useState<Household | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [h, s, b, sh] = await Promise.all([
      apiGet("/api/household").catch(() => null),
      apiGet("/api/services").catch(() => ({ services: [] })),
      apiGet("/api/bookings").catch(() => ({ bookings: [] })),
      apiGet("/api/shifts").catch(() => ({ shifts: [] })),
    ]);
    if (h) { setHousehold(h.household); setRecipients(h.recipients || []); }
    setServices(s.services || []);
    setBookings(b.bookings || []);
    setShifts(sh.shifts || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3000); }

  return (
    <PortalShell title="Family portal" allow={["family"]} nav={nav} active={active} onNav={setActive}>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">{nav.find((n) => n.key === active)?.label}</h1>
        <p className="mt-1 text-sm text-ink-light">{INTRO[active]}</p>
      </div>
      {msg && <p className="mb-4 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}

      {active === "home" && <Home recipients={recipients} bookings={bookings} shifts={shifts} onGo={setActive} />}
      {active === "household" && (
        <HouseholdView household={household} recipients={recipients} onChange={() => { load(); flash("Saved."); }} />
      )}
      {active === "bookings" && (
        <BookingsView recipients={recipients} services={services} bookings={bookings} onChange={() => { load(); flash("Booking requested. Your agency will review it."); }} />
      )}
      {active === "calendar" && <CalendarView events={bookings.map((b) => ({ date: b.start, label: b.serviceName, sub: b.recipientName, tone: b.status === "completed" ? "ok" : b.status === "declined" ? "danger" : b.status === "requested" ? "gold" : "brand" }))} />}
      {active === "messages" && <MessagesPanel />}
      {active === "payments" && <Payments />}
      {active === "documents" && <DocumentsPanel />}
    </PortalShell>
  );
}

function Home({ recipients, bookings, shifts, onGo }: { recipients: Recipient[]; bookings: Booking[]; shifts: Shift[]; onGo: (k: string) => void }) {
  const live = shifts.filter((s) => s.status === "in_progress");
  const recent = shifts.filter((s) => s.status === "completed" && s.notes).slice(0, 3);
  return (
    <div className="space-y-5">
      <div className="card">
        <p className="text-sm text-ink-mid">
          Welcome to Care Royal. Add the people and pets you care for, then request
          services. Your agency reviews and approves every booking.
        </p>
      </div>

      {live.length > 0 && (
        <div className="rounded-xl2 border border-gold/40 bg-gold/10 p-5">
          <h3 className="mb-2 font-serif text-lg text-gold-dark">Care in progress</h3>
          {live.map((s) => (
            <div key={s.shiftId} className="text-sm text-ink">
              {s.caregiverName || "A caregiver"} is with <span className="font-medium">{s.recipientName}</span>
              {" "}for {s.serviceName}{s.clockIn ? ` · since ${new Date(s.clockIn).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-serif text-lg text-ink">Recent visit notes</h3>
          <div className="space-y-3">
            {recent.map((s) => (
              <div key={s.shiftId} className="border-b border-rule pb-3 last:border-0">
                <div className="text-xs text-ink-light">{s.recipientName} · {s.serviceName}{s.start ? ` · ${new Date(s.start).toLocaleDateString()}` : ""}</div>
                <div className="mt-1 whitespace-pre-line text-sm text-ink-mid">{s.notes}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <button onClick={() => onGo("household")} className="card text-left hover:border-brand">
          <div className="text-3xl font-semibold text-brand">{recipients.length}</div>
          <div className="mt-1 text-sm text-ink-mid">Care profiles — add or edit</div>
        </button>
        <button onClick={() => onGo("bookings")} className="card text-left hover:border-brand">
          <div className="text-3xl font-semibold text-brand">{bookings.length}</div>
          <div className="mt-1 text-sm text-ink-mid">Bookings — request or view</div>
        </button>
      </div>
    </div>
  );
}

function HouseholdView({ household, recipients, onChange }: { household: Household | null; recipients: Recipient[]; onChange: () => void }) {
  const [name, setName] = useState(household?.name || "");
  const [address, setAddress] = useState(household?.address || "");
  const [city, setCity] = useState(household?.city || "");
  const [zip, setZip] = useState(household?.zip || "");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setName(household?.name || ""); setAddress(household?.address || "");
    setCity(household?.city || ""); setZip(household?.zip || "");
  }, [household]);

  async function saveHousehold(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/household", { action: "ensure", name, address, city, zip });
    onChange();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveHousehold} className="card space-y-4">
        <h3 className="font-serif text-xl text-ink">Household details</h3>
        <div><label className="label">Household name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Smith family" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3"><label className="label">Address</label><input className="field" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><label className="label">City</label><input className="field" value={city} onChange={(e) => setCity(e.target.value)} /></div>
          <div><label className="label">ZIP</label><input className="field" value={zip} onChange={(e) => setZip(e.target.value)} /></div>
        </div>
        <button className="btn-primary">Save household</button>
      </form>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl text-ink">Care profiles</h3>
          <button onClick={() => setAdding((v) => !v)} className="btn-ghost">{adding ? "Close" : "Add profile"}</button>
        </div>
        {adding && <RecipientForm onDone={() => { setAdding(false); onChange(); }} />}
        {recipients.length === 0 && !adding && <p className="text-sm text-ink-light">No profiles yet. Add a person, pet, or home.</p>}
        <div className="mt-4 space-y-2">
          {recipients.map((r) => (
            <div key={r.recipientId} className="flex items-center justify-between rounded-lg border border-rule px-4 py-3">
              <div>
                <div className="font-medium text-ink">{r.name}</div>
                <div className="text-xs text-ink-light">{typeLabel[r.type] || r.type}{r.conditions ? ` · ${r.conditions}` : ""}</div>
              </div>
              <span className="rounded-md bg-brand-light px-2 py-1 text-xs font-semibold text-brand">{typeLabel[r.type] || r.type}</span>
            </div>
          ))}
        </div>
      </div>

      <InviteForm onDone={onChange} />
    </div>
  );
}

function RecipientForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("person");
  const [dob, setDob] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await apiPost("/api/household", { action: "add_recipient", name, type, dob, conditions, notes }); onDone(); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg bg-paper p-4">
      <div>
        <span className="label">Profile type</span>
        <div className="flex gap-2">
          {["person", "pet", "home"].map((t) => (
            <button type="button" key={t} onClick={() => setType(t)}
              className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${type === t ? "border-brand bg-brand-light text-brand" : "border-rule-dark text-ink-mid"}`}>
              {typeLabel[t]}
            </button>
          ))}
        </div>
      </div>
      <div><label className="label">Name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      {type === "person" && <div><label className="label">Date of birth</label><input className="field" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>}
      <div><label className="label">Conditions / notes for caregivers</label><input className="field" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder={type === "pet" ? "Breed, medications" : "Allergies, mobility, medications"} /></div>
      <div><label className="label">Additional notes</label><textarea className="field" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Add profile"}</button>
    </form>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("manager");
  const [note, setNote] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setNote("");
    try { await apiPost("/api/household", { action: "invite", email, memberRole }); setNote("Invited."); setEmail(""); onDone(); }
    catch (err) { setNote(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <form onSubmit={submit} className="card space-y-4">
      <h3 className="font-serif text-xl text-ink">Invite a family member</h3>
      <p className="text-sm text-ink-mid">Give a spouse or relative access to view or manage your household. They must have a Care Royal account first.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Their email</label><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">Access</label>
          <select className="field" value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
            <option value="manager">Manager (can book & edit)</option>
            <option value="viewer">Viewer (view only)</option>
          </select>
        </div>
      </div>
      {note && <p className="text-sm text-ink-mid">{note}</p>}
      <button className="btn-ghost">Send invite</button>
    </form>
  );
}

function BookingsView({ recipients, services, bookings, onChange }: { recipients: Recipient[]; services: Service[]; bookings: Booking[]; onChange: () => void }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-mid">Request care for any profile. Your agency approves each booking.</p>
        <button onClick={() => setCreating((v) => !v)} className="btn-primary">{creating ? "Close" : "New booking"}</button>
      </div>
      {creating && <NewBooking recipients={recipients} services={services} onDone={() => { setCreating(false); onChange(); }} />}
      <div className="space-y-2">
        {bookings.length === 0 && <div className="card"><p className="text-sm text-ink-light">No bookings yet.</p></div>}
        {bookings.map((b) => (
          <div key={b.bookingId} className="card flex items-center justify-between">
            <div>
              <div className="font-medium text-ink">{b.serviceName} <span className="text-ink-light">for {b.recipientName}</span></div>
              <div className="text-xs text-ink-light">{b.start ? new Date(b.start).toLocaleString() : ""}{(b as { recurrence?: string }).recurrence === "weekly" ? " · repeats weekly" : ""}{b.notes ? ` · ${b.notes}` : ""}</div>
            </div>
            <span className={statusBadge[b.status] || "badge-brand"}>{b.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewBooking({ recipients, services, onDone }: { recipients: Recipient[]; services: Service[]; onDone: () => void }) {
  const [recipientId, setRecipientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [start, setStart] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [occurrences, setOccurrences] = useState(4);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const recipient = recipients.find((r) => r.recipientId === recipientId);
  const options = recipient ? services.filter((s) => s.profileType === recipient.type && s.active !== "false") : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await apiPost("/api/bookings", { action: "create", recipientId, serviceId, start, notes, recurrence, occurrences });
      onDone();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h3 className="font-serif text-xl text-ink">Request a booking</h3>
      {recipients.length === 0 && <p className="text-sm text-danger">Add a care profile first (Household tab).</p>}
      <div><label className="label">Who is this for?</label>
        <select className="field" value={recipientId} onChange={(e) => { setRecipientId(e.target.value); setServiceId(""); }} required>
          <option value="">Select a profile</option>
          {recipients.map((r) => <option key={r.recipientId} value={r.recipientId}>{r.name} ({typeLabel[r.type] || r.type})</option>)}
        </select>
      </div>
      <div><label className="label">Service</label>
        <select className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required disabled={!recipientId}>
          <option value="">{recipientId ? "Select a service" : "Choose a profile first"}</option>
          {options.map((s) => <option key={s.serviceId} value={s.serviceId}>{s.category} — {s.name}{s.rate ? ` ($${s.rate}/${s.pricingModel})` : ""}</option>)}
        </select>
      </div>
      <div><label className="label">Date & time</label><input className="field" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
      <div>
        <label className="label">Repeat</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRecurrence("none")} className={recurrence === "none" ? "chip-on" : "chip-off"}>One time</button>
          <button type="button" onClick={() => setRecurrence("weekly")} className={recurrence === "weekly" ? "chip-on" : "chip-off"}>Weekly</button>
        </div>
        {recurrence === "weekly" && (
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-mid">
            for
            <input type="number" min={2} max={26} className="field field-sm !w-20" value={occurrences} onChange={(e) => setOccurrences(Math.max(2, Math.min(26, parseInt(e.target.value) || 4)))} />
            weeks
          </div>
        )}
      </div>
      <div><label className="label">Notes for the agency</label><textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <button className="btn-primary" disabled={busy || !serviceId}>{busy ? "Requesting..." : "Request booking"}</button>
    </form>
  );
}

interface Invoice { invoiceId: string; amount: string; status: string; serviceName: string; recipientName: string; createdAt: string }

function Payments() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const d = await apiGet("/api/invoices").catch(() => ({ invoices: [] }));
    setInvoices(d.invoices || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function pay(invoiceId: string) {
    setBusy(invoiceId);
    try {
      const d = await apiPost("/api/invoices", { action: "pay", invoiceId });
      if (d.url) window.location.href = d.url;
      else load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Payment could not start");
    } finally { setBusy(""); }
  }

  const statusColor: Record<string, string> = {
    unpaid: "bg-gold/20 text-gold-dark", paid: "bg-ok/15 text-ok", void: "bg-rule text-ink-mid",
  };
  return (
    <div className="space-y-2">
      {invoices.length === 0 && <div className="card"><p className="text-sm text-ink-light">No invoices yet.</p></div>}
      {invoices.map((inv) => (
        <div key={inv.invoiceId} className="card flex items-center justify-between">
          <div>
            <div className="font-medium text-ink">${inv.amount} <span className="text-ink-light">— {inv.serviceName} for {inv.recipientName}</span></div>
            <div className="text-xs text-ink-light">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusColor[inv.status] || ""}`}>{inv.status}</span>
            {inv.status === "unpaid" && (
              <button onClick={() => pay(inv.invoiceId)} disabled={busy === inv.invoiceId} className="btn-primary !px-3 !py-1.5 text-xs">
                {busy === inv.invoiceId ? "…" : "Pay now"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
