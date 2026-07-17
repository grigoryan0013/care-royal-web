"use client";
import { useCallback, useEffect, useState } from "react";
import PortalShell, { type NavItem } from "../../components/PortalShell";
import DocumentsPanel from "../../components/DocumentsPanel";
import CalendarView from "../../components/CalendarView";
import MessagesPanel from "../../components/MessagesPanel";
import Icon from "../../components/Icon";
import { CashOut, SwapBoard } from "../../components/AdvancedPanels";
import { apiGet, apiPost, verifySession, signOutAndRedirect, type SessionUser } from "../lib/session";

const nav: NavItem[] = [
  { key: "schedule", label: "My schedule", icon: "schedule" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "available", label: "Open shifts", icon: "plus" },
  { key: "availability", label: "My availability", icon: "clock" },
  { key: "messages", label: "Messages", icon: "messages" },
  { key: "pay", label: "My pay", icon: "pay" },
  { key: "documents", label: "Documents", icon: "documents" },
];
const INTRO: Record<string, string> = {
  schedule: "Your assigned visits. Clock in when you arrive and clock out with a visit note.",
  calendar: "Your month at a glance.",
  available: "Unassigned shifts you can claim.",
  availability: "Tell your agency which days and hours you can work.",
  messages: "Message the family and your agency about a client.",
  pay: "Your hours and gross pay this period.",
  documents: "Your agreements and acknowledgments to sign.",
};

interface Shift {
  shiftId: string; status: string; start: string; end: string;
  serviceName: string; recipientName: string; recipientType: string;
  careNotes: string; address: string; city: string; householdName: string;
  clockIn: string; clockOut: string; notes: string; householdId?: string; shiftCode?: string;
}
const badge: Record<string, string> = { scheduled: "badge-brand", in_progress: "badge-gold", completed: "badge-ok", open: "badge-brand", cancelled: "badge-muted" };

function getGps(): Promise<string> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve("");
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`),
      () => resolve(""),
      { timeout: 8000 }
    );
  });
}

export default function CaregiverPortal() {
  const [active, setActive] = useState("schedule");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [open, setOpen] = useState<Shift[]>([]);
  const [msg, setMsg] = useState("");
  const [session, setSession] = useState<SessionUser | null>(null);

  const load = useCallback(async () => {
    const d = await apiGet("/api/shifts").catch(() => ({ shifts: [], open: [] }));
    setShifts(d.shifts || []); setOpen(d.open || []);
  }, []);
  useEffect(() => { load(); verifySession().then((u) => setSession(u)); }, [load]);
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3000); }

  const upcoming = shifts.filter((s) => s.status === "scheduled" || s.status === "in_progress");

  // Staff waitlist gate: a caregiver stays "pending" until the agency approves.
  if (session && session.role === "caregiver" && session.status && session.status !== "active") {
    const suspended = session.status === "suspended";
    return (
      <div className="app-bg flex min-h-screen items-center justify-center px-4">
        <div className="card max-w-lg text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand"><Icon name="clock" /></div>
          <h1 className="font-serif text-2xl text-ink">{suspended ? "Your access is paused" : "Waiting for approval"}</h1>
          <p className="mt-3 text-sm text-ink-light">
            {suspended
              ? "Your access has been paused. Please contact your agency."
              : "Thanks for joining. Your agency needs to approve your account before you can see your shifts — you'll be able to sign in as soon as they do."}
          </p>
          <button className="btn-ghost mt-6" onClick={() => signOutAndRedirect()}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <PortalShell title="Caregiver" allow={["caregiver"]} nav={nav} active={active} onNav={setActive}>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">{nav.find((n) => n.key === active)?.label}</h1>
        <p className="mt-1 text-sm text-ink-light">{INTRO[active]}</p>
      </div>
      {msg && <p className="mb-4 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}

      {active === "schedule" && (
        <div className="space-y-3">
          {upcoming.length === 0 && <div className="card"><p className="text-sm text-ink-light">No upcoming shifts. Check Open shifts to claim one.</p></div>}
          {upcoming.map((s) => <ShiftCard key={s.shiftId} s={s} onChange={() => { load(); flash("Updated."); }} />)}
          {shifts.some((s) => s.status === "completed") && (
            <>
              <h3 className="pt-4 text-sm font-semibold uppercase tracking-wide text-ink-light">Completed</h3>
              {shifts.filter((s) => s.status === "completed").slice(0, 8).map((s) => <ShiftCard key={s.shiftId} s={s} onChange={load} />)}
            </>
          )}
        </div>
      )}

      {active === "available" && (
        <div className="space-y-3">
          {open.length === 0 && <div className="card"><p className="text-sm text-ink-light">No open shifts right now.</p></div>}
          {open.map((s) => (
            <div key={s.shiftId} className="card flex items-center justify-between">
              <div>
                <div className="font-medium text-ink">{s.serviceName} <span className="text-ink-light">for {s.recipientName}</span></div>
                <div className="text-xs text-ink-light">{s.start ? new Date(s.start).toLocaleString() : ""}{s.city ? ` · ${s.city}` : ""}</div>
              </div>
              <button onClick={async () => { await apiPost("/api/shifts", { action: "claim", shiftId: s.shiftId }); load(); flash("Shift claimed."); }} className="btn-primary btn-sm">Claim</button>
            </div>
          ))}
          <SwapBoard onChange={() => { load(); flash("Shift taken."); }} />
        </div>
      )}

      {active === "availability" && <Availability onSaved={() => flash("Availability saved.")} />}
      {active === "calendar" && <CalendarView events={shifts.map((s) => ({ id: s.shiftId, date: s.start, label: s.serviceName, sub: s.recipientName, tone: s.status === "completed" ? "ok" : s.status === "in_progress" ? "gold" : s.status === "cancelled" ? "danger" : "brand" }))} />}
      {active === "messages" && <MessagesPanel />}
      {active === "pay" && <MyPay />}
      {active === "documents" && <DocumentsPanel />}
    </PortalShell>
  );
}

function ShiftCard({ s, onChange }: { s: Shift; onChange: () => void }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(true); // post the update to the family Care Journal
  const [swapped, setSwapped] = useState(false);

  async function clockIn() {
    setBusy(true);
    try { const gps = await getGps(); await apiPost("/api/shifts", { action: "clock_in", shiftId: s.shiftId, gps }); onChange(); }
    finally { setBusy(false); }
  }
  async function clockOut() {
    setBusy(true);
    try {
      const gps = await getGps();
      await apiPost("/api/shifts", { action: "clock_out", shiftId: s.shiftId, gps, notes });
      if (share && notes && s.householdId) await apiPost("/api/journal", { action: "post", householdId: s.householdId, text: notes, shiftId: s.shiftId }).catch(() => {});
      onChange();
    } finally { setBusy(false); }
  }
  async function offerSwap() { await apiPost("/api/swaps", { action: "post", shiftId: s.shiftId }); setSwapped(true); }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-ink">{s.serviceName} <span className="text-ink-light">for {s.recipientName}</span></div>
          <div className="text-xs text-ink-light">{s.start ? new Date(s.start).toLocaleString() : ""}{s.address ? ` · ${s.address}` : ""}{s.city ? `, ${s.city}` : ""}</div>
          {s.careNotes && <div className="mt-1 text-xs text-ink-mid">Care notes: {s.careNotes}</div>}
          {s.shiftCode && (s.status === "scheduled" || s.status === "in_progress") && <div className="mt-1 text-xs text-ink-light">Phone clock-in code: <span className="font-mono font-semibold text-ink">{s.shiftCode}</span></div>}
        </div>
        <span className={badge[s.status] || "badge-brand"}>{s.status.replace("_", " ")}</span>
      </div>

      {s.status === "scheduled" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={clockIn} disabled={busy} className="btn-primary w-full sm:w-auto">{busy ? "…" : "Clock in"}</button>
          <button onClick={offerSwap} disabled={swapped} className="btn-ghost btn-sm">{swapped ? "Offered for swap" : "Offer for swap"}</button>
        </div>
      )}
      {s.status === "in_progress" && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-ok"><span className="stat-dot bg-ok animate-pulse" />Clocked in {s.clockIn ? new Date(s.clockIn).toLocaleTimeString() : ""}</div>
          <textarea className="field" rows={2} placeholder="Visit notes (meals, meds, tasks)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-ink-mid"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share this update with the family (Care Journal)</label>
          <button onClick={clockOut} disabled={busy} className="btn-primary w-full sm:w-auto">{busy ? "…" : "Clock out"}</button>
        </div>
      )}
      {s.status === "completed" && s.notes && (
        <div className="mt-3 whitespace-pre-line rounded-lg bg-paper p-3 text-xs text-ink-mid">{s.notes}</div>
      )}
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function Availability({ onSaved }: { onSaved: () => void }) {
  const [days, setDays] = useState<number[]>([]);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet("/api/availability").then((d) => {
      try { const a = d.availability ? JSON.parse(d.availability) : null; if (a) { setDays(a.days || []); setFrom(a.from || "09:00"); setTo(a.to || "17:00"); } } catch { /* ignore */ }
    }).catch(() => {});
    apiGet("/api/profile").then((d) => setPin(d.profile?.pin || "")).catch(() => {});
  }, []);

  function toggle(i: number) { setDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()); }
  async function save() {
    setBusy(true);
    try { await apiPost("/api/availability", { action: "set", availability: JSON.stringify({ days, from, to }) }); if (pin) await apiPost("/api/profile", { pin }); onSaved(); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="card space-y-5">
        <div>
          <label className="label">Days I can work</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => toggle(i)} className={days.includes(i) ? "chip-on" : "chip-off"}>{d}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Available from</label><input type="time" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">Available until</label><input type="time" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save availability"}</button>
        <p className="hint">Your agency sees this when assigning shifts, so they only book you when you&apos;re free.</p>
      </div>
      <div className="card space-y-2">
        <label className="label">Phone clock-in PIN</label>
        <input className="field" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Choose a 4-6 digit PIN" />
        <p className="hint">No smartphone on a visit? Call your agency&apos;s The Care Royal phone line, enter this PIN, then the shift code shown on each shift to clock in and out.</p>
      </div>
    </div>
  );
}

interface PayLine { date: string; service: string; recipient: string; hours: number; amount: number }
function MyPay() {
  const [data, setData] = useState<{ hours: number; gross: number; lines: PayLine[] }>({ hours: 0, gross: 0, lines: [] });
  useEffect(() => {
    apiGet("/api/payroll").then((d) => setData({ hours: d.hours || 0, gross: d.gross || 0, lines: d.lines || [] })).catch(() => {});
  }, []);
  return (
    <div className="space-y-5">
      <CashOut />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card"><div className="text-3xl font-semibold text-brand">{data.hours}</div><div className="mt-1 text-sm text-ink-mid">Hours this period</div></div>
        <div className="card"><div className="text-3xl font-semibold text-ok">${data.gross.toFixed(2)}</div><div className="mt-1 text-sm text-ink-mid">Gross pay this period</div></div>
      </div>
      <div className="card">
        <h3 className="mb-3 font-serif text-lg text-ink">Completed shifts</h3>
        {data.lines.length === 0 && <p className="text-sm text-ink-light">No completed shifts yet.</p>}
        <div className="space-y-2">
          {data.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between border-b border-rule pb-2 text-sm last:border-0">
              <div>
                <div className="text-ink">{l.service} <span className="text-ink-light">for {l.recipient}</span></div>
                <div className="text-xs text-ink-light">{l.date ? new Date(l.date).toLocaleDateString() : ""} · {l.hours}h</div>
              </div>
              <div className="font-medium text-ink">${l.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-light">Payouts are issued by your agency through The Care Royal payroll.</p>
    </div>
  );
}
