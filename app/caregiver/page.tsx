"use client";
import { useCallback, useEffect, useState } from "react";
import PortalShell, { type NavItem } from "../../components/PortalShell";
import DocumentsPanel from "../../components/DocumentsPanel";
import CalendarView from "../../components/CalendarView";
import MessagesPanel from "../../components/MessagesPanel";
import { apiGet, apiPost } from "../lib/session";

const nav: NavItem[] = [
  { key: "schedule", label: "My schedule" },
  { key: "calendar", label: "Calendar" },
  { key: "available", label: "Open shifts" },
  { key: "messages", label: "Messages" },
  { key: "pay", label: "My pay" },
  { key: "documents", label: "Documents" },
];

interface Shift {
  shiftId: string; status: string; start: string; end: string;
  serviceName: string; recipientName: string; recipientType: string;
  careNotes: string; address: string; city: string; householdName: string;
  clockIn: string; clockOut: string; notes: string;
}

const statusColor: Record<string, string> = {
  scheduled: "bg-brand-light text-brand", in_progress: "bg-gold/20 text-gold-dark",
  completed: "bg-ok/15 text-ok", open: "bg-brand-light text-brand",
};

// Best-effort geolocation for the clock stamp.
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

  const load = useCallback(async () => {
    const d = await apiGet("/api/shifts").catch(() => ({ shifts: [], open: [] }));
    setShifts(d.shifts || []); setOpen(d.open || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3000); }

  return (
    <PortalShell title="Caregiver" allow={["caregiver"]} nav={nav} active={active} onNav={setActive}>
      <h1 className="mb-1 font-serif text-3xl text-ink">{nav.find((n) => n.key === active)?.label}</h1>
      <p className="mb-6 text-sm text-ink-light">Caregiver app</p>
      {msg && <p className="mb-4 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}

      {active === "schedule" && (
        <div className="space-y-3">
          {shifts.length === 0 && <div className="card"><p className="text-sm text-ink-light">No shifts assigned yet.</p></div>}
          {shifts.map((s) => <ShiftCard key={s.shiftId} s={s} onChange={() => { load(); flash("Updated."); }} />)}
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
              <button onClick={async () => { await apiPost("/api/shifts", { action: "claim", shiftId: s.shiftId }); load(); flash("Shift claimed."); }} className="btn-primary">Claim</button>
            </div>
          ))}
        </div>
      )}

      {active === "calendar" && <CalendarView events={shifts.map((s) => ({ date: s.start, label: s.serviceName, sub: s.recipientName, tone: s.status === "completed" ? "ok" : s.status === "in_progress" ? "gold" : "brand" }))} />}
      {active === "messages" && <MessagesPanel />}
      {active === "pay" && <MyPay />}
      {active === "documents" && <DocumentsPanel />}
    </PortalShell>
  );
}

function ShiftCard({ s, onChange }: { s: Shift; onChange: () => void }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function clockIn() {
    setBusy(true);
    try { const gps = await getGps(); await apiPost("/api/shifts", { action: "clock_in", shiftId: s.shiftId, gps }); onChange(); }
    finally { setBusy(false); }
  }
  async function clockOut() {
    setBusy(true);
    try { const gps = await getGps(); await apiPost("/api/shifts", { action: "clock_out", shiftId: s.shiftId, gps, notes }); onChange(); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-ink">{s.serviceName} <span className="text-ink-light">for {s.recipientName}</span></div>
          <div className="text-xs text-ink-light">{s.start ? new Date(s.start).toLocaleString() : ""}{s.address ? ` · ${s.address}` : ""}{s.city ? `, ${s.city}` : ""}</div>
          {s.careNotes && <div className="mt-1 text-xs text-ink-mid">Care notes: {s.careNotes}</div>}
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusColor[s.status] || "bg-brand-light text-brand"}`}>{s.status.replace("_", " ")}</span>
      </div>

      {s.status === "scheduled" && (
        <button onClick={clockIn} disabled={busy} className="btn-primary mt-4">{busy ? "…" : "Clock in"}</button>
      )}
      {s.status === "in_progress" && (
        <div className="mt-4 space-y-2">
          <div className="text-xs text-ink-light">Clocked in {s.clockIn ? new Date(s.clockIn).toLocaleTimeString() : ""}</div>
          <textarea className="field" rows={2} placeholder="Visit notes (meals, meds, tasks)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button onClick={clockOut} disabled={busy} className="btn-primary">{busy ? "…" : "Clock out"}</button>
        </div>
      )}
      {s.status === "completed" && s.notes && (
        <div className="mt-3 whitespace-pre-line rounded-lg bg-paper p-3 text-xs text-ink-mid">{s.notes}</div>
      )}
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
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card"><div className="text-3xl font-semibold text-brand">{data.hours}</div><div className="mt-1 text-sm text-ink-mid">Hours this period</div></div>
        <div className="card"><div className="text-3xl font-semibold text-brand">${data.gross.toFixed(2)}</div><div className="mt-1 text-sm text-ink-mid">Gross pay this period</div></div>
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
      <p className="text-xs text-ink-light">Payouts are issued by your agency through Care Royal payroll.</p>
    </div>
  );
}
