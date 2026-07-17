"use client";
// Roadmap feature UI (items 1,2,4,5,6,7,8,9,10). Kept out of the large portal
// page files; imported and wired in via new nav sections / inline controls.
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../app/lib/session";

type Row = Record<string, any>;

function printHtml(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<html><head><title>${title}</title><style>body{font-family:Inter,Arial,sans-serif;color:#14181B;padding:32px;max-width:760px;margin:0 auto}h1,h2{font-family:Georgia,serif}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}th,td{border:1px solid #E0E3E7;padding:6px 8px;text-align:left}th{background:#f1f4f8}.muted{color:#57636C;font-size:12px}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
function downloadCsv(name: string, rows: Row[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

// ==================== ITEM 4: AI layer =====================================
const AI_TASKS = [
  { key: "care_plan", label: "Care plan", hint: "Generate a structured care plan from a recipient's details." },
  { key: "summarize", label: "Summarize notes + risk flags", hint: "Condense visit notes and surface fall / pain / behavior flags." },
  { key: "family_update", label: "Family update", hint: "Draft a warm, honest update for a family member." },
];
export function AiPanel() {
  const [task, setTask] = useState("care_plan");
  const [fields, setFields] = useState<Row>({});
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  async function run() {
    setBusy(true); setOut(""); setCopied(false);
    try { const d = await apiPost("/api/ai", { task, input: fields }); setOut(d.text || ""); }
    catch (e) { setOut(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }
  function copy() { navigator.clipboard?.writeText(out).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }
  const cur = AI_TASKS.find((t) => t.key === task)!;
  return (
    <div className="space-y-5">
      <div className="card">
        <p className="text-sm text-ink-mid">Built-in templates draft care plans, summarize visit notes with risk flags, and write family updates — instantly, with no setup or external service. Review and edit everything before you use it; it assists, it doesn&apos;t replace your judgment.</p>
      </div>
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {AI_TASKS.map((t) => <button key={t.key} onClick={() => { setTask(t.key); setOut(""); }} className={task === t.key ? "chip-on" : "chip-off"}>{t.label}</button>)}
        </div>
        <p className="text-xs text-ink-light">{cur.hint}</p>
        {task === "care_plan" && (<div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Recipient name</label><input className="field field-sm" onChange={(e) => set("recipientName", e.target.value)} /></div>
          <div><label className="label">Conditions</label><input className="field field-sm" onChange={(e) => set("conditions", e.target.value)} placeholder="Diabetes, limited mobility" /></div>
          <div><label className="label">Services</label><input className="field field-sm" onChange={(e) => set("services", e.target.value)} placeholder="Personal care, companionship" /></div>
          <div><label className="label">Frequency</label><input className="field field-sm" onChange={(e) => set("frequency", e.target.value)} placeholder="3x per week" /></div>
        </div>)}
        {task === "summarize" && <div><label className="label">Visit notes</label><textarea className="field" rows={5} onChange={(e) => set("notes", e.target.value)} placeholder="Paste one or more visit notes…" /></div>}
        {task === "family_update" && (<div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Family member</label><input className="field field-sm" onChange={(e) => set("familyName", e.target.value)} /></div>
          <div><label className="label">Recipient</label><input className="field field-sm" onChange={(e) => set("recipientName", e.target.value)} /></div>
          <div><label className="label">Today&apos;s activities</label><input className="field field-sm" onChange={(e) => set("activities", e.target.value)} placeholder="a walk, lunch, medication" /></div>
          <div><label className="label">Mood</label><input className="field field-sm" onChange={(e) => set("mood", e.target.value)} placeholder="cheerful, tired" /></div>
          <div className="sm:col-span-2"><label className="label">Next visit / plan</label><input className="field field-sm" onChange={(e) => set("next", e.target.value)} placeholder="Thursday morning" /></div>
        </div>)}
        <button onClick={run} disabled={busy} className="btn-primary">{busy ? "Generating…" : "Generate"}</button>
        {out && <div className="space-y-2">
          <div className="flex justify-end"><button onClick={copy} className="btn-ghost btn-sm">{copied ? "Copied" : "Copy"}</button></div>
          <div className="whitespace-pre-line rounded-lg border border-rule bg-paper p-4 text-sm text-ink-mid">{out}</div>
        </div>}
      </div>
    </div>
  );
}

// ==================== ITEM 1 + 10: Billing / EVV / claims / audit ==========
export function BillingPanel() {
  const [tab, setTab] = useState<"payers" | "auth" | "evv" | "claims" | "audit">("payers");
  const tabs = [["payers", "Payers"], ["auth", "Authorizations"], ["evv", "EVV export"], ["claims", "Claims"], ["audit", "Audit & QuickBooks"]] as [typeof tab, string][];
  return (
    <div className="space-y-5">
      <div className="card"><p className="text-sm text-ink-mid">Electronic Visit Verification and insurance billing. GPS clock-in/out on every completed shift feeds the EVV export and claim generation for Medicaid, VA and LTC-insurance payers.</p></div>
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-rule bg-white p-1">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={tab === k ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>{l}</button>)}
      </div>
      {tab === "payers" && <Payers />}
      {tab === "auth" && <Authorizations />}
      {tab === "evv" && <EvvExport />}
      {tab === "claims" && <Claims />}
      {tab === "audit" && <AuditQuickbooks />}
    </div>
  );
}
function Payers() {
  const [payers, setPayers] = useState<Row[]>([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<Row>({ type: "medicaid", evvFormat: "hhaexchange" });
  const load = useCallback(async () => setPayers((await apiGet("/api/payers").catch(() => ({ payers: [] }))).payers || []), []);
  useEffect(() => { load(); }, [load]);
  async function add() { await apiPost("/api/payers", { action: "create", ...f }); setAdding(false); setF({ type: "medicaid", evvFormat: "hhaexchange" }); load(); }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={() => setAdding((v) => !v)} className="btn-ghost btn-sm">{adding ? "Close" : "Add payer"}</button></div>
      {adding && <div className="card grid gap-3 sm:grid-cols-2">
        <div><label className="label">Name</label><input className="field field-sm" onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="State Medicaid" /></div>
        <div><label className="label">Type</label><select className="field field-sm" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="medicaid">Medicaid</option><option value="va">VA</option><option value="ltc">LTC insurance</option><option value="private">Private</option></select></div>
        <div><label className="label">Payer ID</label><input className="field field-sm" onChange={(e) => setF({ ...f, payerId2: e.target.value })} /></div>
        <div><label className="label">EVV aggregator</label><select className="field field-sm" value={f.evvFormat} onChange={(e) => setF({ ...f, evvFormat: e.target.value })}><option value="hhaexchange">HHAeXchange</option><option value="sandata">Sandata</option><option value="tellus">Tellus</option></select></div>
        <button onClick={add} className="btn-primary btn-sm sm:col-span-2 sm:w-auto">Save payer</button>
      </div>}
      {payers.length === 0 && <div className="card"><p className="text-sm text-ink-light">No payers yet. Add the Medicaid / insurance payers you bill.</p></div>}
      {payers.map((p) => <div key={p.payerId} className="card flex items-center justify-between"><div><div className="font-medium text-ink">{p.name}</div><div className="text-xs text-ink-light">{p.type} · {p.evvFormat}{p.payerId2 ? ` · ${p.payerId2}` : ""}</div></div></div>)}
    </div>
  );
}
function Authorizations() {
  const [auths, setAuths] = useState<Row[]>([]);
  const [payers, setPayers] = useState<Row[]>([]);
  const [recipients, setRecipients] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  const [f, setF] = useState<Row>({});
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => {
    const [a, p, ag, s] = await Promise.all([apiGet("/api/authorizations").catch(() => ({ authorizations: [] })), apiGet("/api/payers").catch(() => ({ payers: [] })), apiGet("/api/agency").catch(() => ({ clients: [] })), apiGet("/api/services").catch(() => ({ services: [] }))]);
    setAuths(a.authorizations || []); setPayers(p.payers || []); setServices(s.services || []);
    setRecipients((ag.clients || []).flatMap((c: Row) => c.recipients || []));
  }, []);
  useEffect(() => { load(); }, [load]);
  async function add() { await apiPost("/api/authorizations", { action: "create", ...f }); setAdding(false); setF({}); load(); }
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={() => setAdding((v) => !v)} className="btn-ghost btn-sm">{adding ? "Close" : "Add authorization"}</button></div>
      {adding && <div className="card grid gap-3 sm:grid-cols-2">
        <div><label className="label">Payer</label><select className="field field-sm" onChange={(e) => setF({ ...f, payerId: e.target.value })}><option value="">Select</option>{payers.map((p) => <option key={p.payerId} value={p.payerId}>{p.name}</option>)}</select></div>
        <div><label className="label">Recipient</label><select className="field field-sm" onChange={(e) => setF({ ...f, recipientId: e.target.value })}><option value="">Select</option>{recipients.map((r) => <option key={r.recipientId} value={r.recipientId}>{r.name}</option>)}</select></div>
        <div><label className="label">Service</label><select className="field field-sm" onChange={(e) => setF({ ...f, serviceId: e.target.value })}><option value="">Select</option>{services.map((s) => <option key={s.serviceId} value={s.serviceId}>{s.name}</option>)}</select></div>
        <div><label className="label">Auth #</label><input className="field field-sm" onChange={(e) => setF({ ...f, authNumber: e.target.value })} /></div>
        <div><label className="label">Units approved</label><input className="field field-sm" onChange={(e) => setF({ ...f, unitsApproved: e.target.value })} /></div>
        <div><label className="label">End date</label><input type="date" className="field field-sm" onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        <button onClick={add} className="btn-primary btn-sm sm:col-span-2 sm:w-auto">Save authorization</button>
      </div>}
      {auths.length === 0 && <div className="card"><p className="text-sm text-ink-light">No authorizations yet.</p></div>}
      {auths.map((a) => <div key={a.authId} className="card"><div className="font-medium text-ink">{a.recipientName} — {a.serviceName}</div><div className="text-xs text-ink-light">{a.payerName} · Auth {a.authNumber || "—"} · {a.unitsApproved} units{a.endDate ? ` · through ${a.endDate}` : ""}</div></div>)}
    </div>
  );
}
function EvvExport() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { apiGet("/api/evv").then((d) => setRows(d.rows || [])).catch(() => {}); }, []);
  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between">
        <div><h3 className="font-serif text-lg text-ink">Electronic Visit Verification</h3><p className="mt-1 text-sm text-ink-light">{rows.length} verified visit{rows.length === 1 ? "" : "s"} ready to export to your state aggregator.</p></div>
        <button onClick={() => downloadCsv("evv-export.csv", rows)} disabled={!rows.length} className="btn-primary btn-sm">Download CSV</button>
      </div>
      {rows.length === 0 ? <div className="card"><p className="text-sm text-ink-light">No completed visits yet. EVV rows are created automatically when caregivers clock in and out.</p></div> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="text-ink-light"><tr><th className="py-2">Date</th><th>Recipient</th><th>Service</th><th>Caregiver</th><th>Hours</th><th>Verified</th></tr></thead><tbody>
          {rows.slice(0, 40).map((r) => <tr key={r.visitId} className="border-t border-rule"><td className="py-2">{r.date}</td><td>{r.recipient}</td><td>{r.service}</td><td>{r.caregiver}</td><td>{r.hours}</td><td>{r.verified === "yes" ? <span className="badge-ok">GPS</span> : <span className="badge-muted">manual</span>}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}
function Claims() {
  const [claims, setClaims] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = useCallback(async () => setClaims((await apiGet("/api/claims").catch(() => ({ claims: [] }))).claims || []), []);
  useEffect(() => { load(); }, [load]);
  async function gen() { setBusy(true); try { const d = await apiPost("/api/claims", { action: "generate" }); setNote(`Generated ${d.created} claim(s). Only completed visits with a billing code on the service are billed.`); load(); } finally { setBusy(false); } }
  async function act(claimId: string, action: string) { await apiPost("/api/claims", { action, claimId }); load(); }
  const tone: Row = { ready: "badge-brand", submitted: "badge-warn", paid: "badge-ok" };
  return (
    <div className="space-y-3">
      {note && <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">{note}</p>}
      <div className="card flex items-center justify-between"><div><h3 className="font-serif text-lg text-ink">Insurance claims</h3><p className="mt-1 text-sm text-ink-light">CMS-1500 style claims built from authorized, completed visits.</p></div><button onClick={gen} disabled={busy} className="btn-primary btn-sm">{busy ? "…" : "Generate claims"}</button></div>
      {claims.length === 0 && <div className="card"><p className="text-sm text-ink-light">No claims yet. Set a billing code on a service (Services tab), add an authorization, then generate.</p></div>}
      {claims.map((c) => <div key={c.claimId} className="card flex items-center justify-between"><div><div className="font-medium text-ink">${c.amount} <span className="text-ink-light">· {c.recipientName} · {c.serviceName}</span></div><div className="text-xs text-ink-light">{c.billingCode} · {c.units} units · {c.dateOfService}{c.payerName ? ` · ${c.payerName}` : ""}</div></div><div className="flex items-center gap-2"><span className={tone[c.status] || "badge-muted"}>{c.status}</span>{c.status === "ready" && <button onClick={() => act(c.claimId, "mark_submitted")} className="text-xs font-semibold text-brand">Mark submitted</button>}{c.status === "submitted" && <button onClick={() => act(c.claimId, "mark_paid")} className="text-xs font-semibold text-ok">Mark paid</button>}</div></div>)}
    </div>
  );
}
function AuditQuickbooks() {
  const [qb, setQb] = useState<{ connected: boolean } | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => { apiPost("/api/quickbooks", { action: "status" }).then(setQb).catch(() => setQb({ connected: false })); }, []);
  async function connect() { try { const d = await apiPost("/api/quickbooks", { action: "connect" }); if (d.url) window.location.href = d.url; else { setNote("QuickBooks connected (demo)."); setQb({ connected: true }); } } catch (e) { setNote(e instanceof Error ? e.message : ""); } }
  async function sync() { const d = await apiPost("/api/quickbooks", { action: "sync" }); setNote(d.synced != null ? `Synced ${d.synced} invoice(s) to QuickBooks.` : (d.note || "")); }
  async function auditPack() {
    const d = await apiGet("/api/audit-pack");
    const rows = (arr: Row[], cols: [string, string][]) => `<table><tr>${cols.map(([, l]) => `<th>${l}</th>`).join("")}</tr>${arr.map((r) => `<tr>${cols.map(([k]) => `<td>${String(r[k] ?? "")}</td>`).join("")}</tr>`).join("")}</table>`;
    printHtml("Audit pack", `<h1>State Audit Pack</h1><p class="muted">${d.agency} · generated ${new Date(d.generatedAt).toLocaleString()}</p>
      <h2>EVV visit log (${(d.evv || []).length})</h2>${rows(d.evv || [], [["date", "Date"], ["recipient", "Recipient"], ["service", "Service"], ["caregiver", "Caregiver"], ["hours", "Hours"], ["verified", "Verified"]])}
      <h2>Signed documents (${(d.documents || []).length})</h2>${rows(d.documents || [], [["title", "Document"], ["householdName", "Client"], ["signedBy", "Signed by"], ["signedAt", "Signed at"]])}
      <h2>Claims (${(d.claims || []).length})</h2>${rows(d.claims || [], [["dateOfService", "Date"], ["recipientName", "Recipient"], ["billingCode", "Code"], ["amount", "Amount"], ["status", "Status"]])}
      <h2>Activity log</h2>${rows(d.events || [], [["createdAt", "When"], ["text", "Event"], ["actor", "Actor"]])}`);
  }
  return (
    <div className="space-y-3">
      {note && <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">{note}</p>}
      <div className="card"><h3 className="font-serif text-lg text-ink">State audit pack</h3><p className="mt-1 mb-3 text-sm text-ink-light">One-click bundle of EVV visit logs, signed documents, claims and your activity log — print or save as PDF.</p><button onClick={auditPack} className="btn-primary btn-sm">Build audit pack</button></div>
      <div className="card"><h3 className="font-serif text-lg text-ink">QuickBooks Online</h3><p className="mt-1 mb-3 text-sm text-ink-light">Sync invoices to your own QuickBooks company for accounting.</p>
        {qb?.connected ? <div className="flex items-center gap-2"><span className="badge-ok">Connected</span><button onClick={sync} className="btn-soft btn-sm">Sync invoices</button></div> : <button onClick={connect} className="btn-ghost btn-sm">Connect QuickBooks</button>}
      </div>
    </div>
  );
}

// ==================== ITEM 6: Franchise / white-label ======================
export function GrowthPanel() {
  const [b, setB] = useState<Row>({});
  const [org, setOrg] = useState<Row | null>(null);
  const [locations, setLocations] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [orgName, setOrgName] = useState("");
  const [locName, setLocName] = useState("");
  const load = useCallback(async () => {
    const [br, o] = await Promise.all([apiGet("/api/branding").catch(() => ({ branding: {} })), apiGet("/api/org").catch(() => ({ org: null, locations: [] }))]);
    setB(br.branding || {}); setOrg(o.org); setLocations(o.locations || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function saveBrand() { await apiPost("/api/branding", b); setNote("Branding saved. Your portals now use these colors and name."); }
  async function createOrg() { await apiPost("/api/org", { action: "create_org", name: orgName }); setNote("Organization created."); load(); }
  async function addLoc() { await apiPost("/api/org", { action: "add_location", name: locName }); setLocName(""); load(); }
  return (
    <div className="space-y-5">
      {note && <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">{note}</p>}
      <div className="card space-y-4">
        <div><h3 className="font-serif text-lg text-ink">White-label branding</h3><p className="mt-1 text-sm text-ink-light">Make The Care Royal your own. These apply across your family, caregiver and agency portals.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Display name</label><input className="field field-sm" value={b.displayName || ""} onChange={(e) => setB({ ...b, displayName: e.target.value })} /></div>
          <div><label className="label">Logo URL</label><input className="field field-sm" value={b.logoUrl || ""} onChange={(e) => setB({ ...b, logoUrl: e.target.value })} placeholder="https://…/logo.png" /></div>
          <div><label className="label">Brand color</label><input type="color" className="field field-sm h-10" value={b.brandColor || "#4B39EF"} onChange={(e) => setB({ ...b, brandColor: e.target.value })} /></div>
          <div><label className="label">Accent color</label><input type="color" className="field field-sm h-10" value={b.accentColor || "#39D2C0"} onChange={(e) => setB({ ...b, accentColor: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Custom domain</label><input className="field field-sm" value={b.customDomain || ""} onChange={(e) => setB({ ...b, customDomain: e.target.value })} placeholder="care.youragency.com" /></div>
        </div>
        <button onClick={saveBrand} className="btn-primary btn-sm">Save branding</button>
      </div>
      <div className="card space-y-4">
        <div><h3 className="font-serif text-lg text-ink">Multi-location</h3><p className="mt-1 text-sm text-ink-light">Run several offices under one parent organization, each with its own clients, staff and billing.</p></div>
        {!org ? (
          <div className="flex items-end gap-2"><div className="flex-1"><label className="label">Organization name</label><input className="field field-sm" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Home Care Group" /></div><button onClick={createOrg} disabled={!orgName} className="btn-primary btn-sm">Create org</button></div>
        ) : (<>
          <div className="text-sm text-ink-mid">Organization: <b className="text-ink">{org.name}</b></div>
          <div className="space-y-2">{locations.map((l) => <div key={l.tenantId} className="flex items-center justify-between rounded-lg border border-rule px-3 py-2 text-sm"><span className="font-medium text-ink">{l.name}</span><span className="badge-brand capitalize">{l.plan}</span></div>)}</div>
          <div className="flex items-end gap-2"><div className="flex-1"><label className="label">New location</label><input className="field field-sm" value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Downtown office" /></div><button onClick={addLoc} disabled={!locName} className="btn-ghost btn-sm">Add location</button></div>
        </>)}
      </div>
    </div>
  );
}

// ==================== ITEM 9: benchmarking =================================
export function BenchmarkPanel() {
  const [d, setD] = useState<Row | null>(null);
  useEffect(() => { apiGet("/api/benchmarks").then(setD).catch(() => {}); }, []);
  if (!d) return <div className="card"><p className="text-sm text-ink-light">Loading benchmarks…</p></div>;
  const Bar = ({ label, mine, peer, suffix = "" }: { label: string; mine: number; peer: number; suffix?: string }) => {
    const max = Math.max(mine, peer, 1); const better = mine >= peer;
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm"><span className="text-ink-mid">{label}</span><span className={better ? "font-semibold text-ok" : "font-semibold text-gold-dark"}>{mine}{suffix} <span className="text-ink-light">vs {peer}{suffix}</span></span></div>
        <div className="h-2 overflow-hidden rounded-full bg-paper"><div className="h-full bg-brand" style={{ width: `${(mine / max) * 100}%` }} /></div>
      </div>
    );
  };
  return (
    <div className="space-y-5">
      <div className="card"><p className="text-sm text-ink-mid">How your agency compares to <b>{d.cohort}</b> — fully anonymized, aggregated across The Care Royal network. No client or caregiver data is ever shared.</p></div>
      <div className="card space-y-4">
        <Bar label="Shift fill rate" mine={d.mine.fillRate} peer={d.peers.fillRate} suffix="%" />
        <Bar label="Average caregiver wage" mine={d.mine.avgWage} peer={d.peers.avgWage} suffix="/hr" />
        <Bar label="Active caregivers" mine={d.mine.caregivers} peer={d.peers.caregivers} />
      </div>
    </div>
  );
}

// ==================== ITEM 2: instant pay (agency payouts view) =============
export function PayoutsPanel() {
  const [d, setD] = useState<{ payouts: Row[]; totalFees: number }>({ payouts: [], totalFees: 0 });
  useEffect(() => { apiGet("/api/payouts").then((r) => setD({ payouts: r.payouts || [], totalFees: r.totalFees || 0 })).catch(() => {}); }, []);
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between"><h3 className="font-serif text-lg text-ink">Instant pay</h3><span className="text-xs text-ink-light">Fees earned: <b className="text-ink">${d.totalFees.toFixed(2)}</b></span></div>
      <p className="mb-3 text-sm text-ink-light">Caregivers can cash out earned wages instantly from their portal. You earn a per-transfer fee; The Care Royal never holds the funds.</p>
      {d.payouts.length === 0 ? <p className="text-sm text-ink-light">No cash-outs yet.</p> : <div className="space-y-2">{d.payouts.slice(0, 10).map((p) => <div key={p.payoutId} className="flex items-center justify-between border-b border-rule pb-2 text-sm last:border-0"><span className="text-ink">{p.name} <span className="text-ink-light">· {new Date(p.createdAt).toLocaleDateString()}</span></span><span className="font-medium text-ink">${p.net} <span className="text-ink-light">(fee ${p.fee})</span></span></div>)}</div>}
    </div>
  );
}

// ==================== ITEM 7: background check control (Staff) =============
export function BackgroundCheck({ userId, status, onChange }: { userId: string; status?: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const s = status || "none";
  const tone: Row = { clear: "badge-ok", pending: "badge-warn", consider: "badge-danger", none: "badge-muted" };
  const label: Row = { clear: "Cleared", pending: "Check pending", consider: "Needs review", none: "No check" };
  async function invite() { setBusy(true); try { await apiPost("/api/background", { action: "invite", userId }); onChange(); } finally { setBusy(false); } }
  return (
    <div className="flex items-center gap-2">
      <span className={tone[s] || "badge-muted"}>{label[s] || s}</span>
      {(s === "none" || s === "pending") && <button onClick={invite} disabled={busy} className="text-xs font-semibold text-brand hover:underline">{busy ? "…" : s === "pending" ? "Re-check" : "Run check"}</button>}
    </div>
  );
}

// ==================== ITEM 8: Care Journal (family + caregiver) =============
export function CareJournal({ canPost, householdId }: { canPost: boolean; householdId?: string }) {
  const [entries, setEntries] = useState<Row[]>([]);
  const [text, setText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setEntries((await apiGet("/api/journal").catch(() => ({ entries: [] }))).entries || []), []);
  useEffect(() => { load(); }, [load]);
  async function post() {
    if (!text && !photoUrl) return; setBusy(true);
    try { await apiPost("/api/journal", { action: "post", householdId, text, photoUrl }); setText(""); setPhotoUrl(""); load(); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div className="card"><p className="text-sm text-ink-mid">A shared timeline of visit updates and photos for the family — the moments that matter, in one place.</p></div>
      {canPost && householdId && (
        <div className="card space-y-3">
          <textarea className="field" rows={2} placeholder="Share an update from today's visit…" value={text} onChange={(e) => setText(e.target.value)} />
          <input className="field field-sm" placeholder="Photo URL (optional)" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          <button onClick={post} disabled={busy} className="btn-primary btn-sm">{busy ? "Posting…" : "Post to journal"}</button>
        </div>
      )}
      {entries.length === 0 && <div className="card"><p className="text-sm text-ink-light">No journal entries yet. Updates from caregivers will appear here.</p></div>}
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.entryId} className="card">
            <div className="flex items-center justify-between"><span className="text-sm font-medium text-ink">{e.authorName}</span><span className="text-xs text-ink-light">{new Date(e.createdAt).toLocaleString()}</span></div>
            {e.text && <p className="mt-2 whitespace-pre-line text-sm text-ink-mid">{e.text}</p>}
            {e.photoUrl && <img src={e.photoUrl} alt="" className="mt-2 max-h-64 rounded-lg object-cover" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== ITEM 2 + 5: caregiver cash-out & swaps ================
export function CashOut() {
  const [d, setD] = useState<{ available: number; fee: number; payouts: Row[] }>({ available: 0, fee: 0, payouts: [] });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = useCallback(async () => { const r = await apiGet("/api/payouts").catch(() => ({ available: 0, fee: 0, payouts: [] })); setD({ available: r.available || 0, fee: r.fee || 0, payouts: r.payouts || [] }); }, []);
  useEffect(() => { load(); }, [load]);
  async function cashOut() { setBusy(true); setNote(""); try { const r = await apiPost("/api/payouts", { action: "cash_out" }); setNote(r.note || "Cash-out sent."); load(); } catch (e) { setNote(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); } }
  return (
    <div className="card">
      <h3 className="mb-1 font-serif text-lg text-ink">Instant pay</h3>
      <p className="text-sm text-ink-light">Cash out your earned wages now for a ${d.fee.toFixed(2)} fee instead of waiting for payday.</p>
      <div className="my-3 text-3xl font-semibold text-ok">${d.available.toFixed(2)} <span className="text-sm font-normal text-ink-light">available</span></div>
      <button onClick={cashOut} disabled={busy || d.available < 1} className="btn-primary btn-sm">{busy ? "…" : `Cash out $${Math.max(0, d.available - d.fee).toFixed(2)}`}</button>
      {note && <p className="mt-2 text-xs text-ink-mid">{note}</p>}
    </div>
  );
}
export function SwapBoard({ onChange }: { onChange: () => void }) {
  const [swaps, setSwaps] = useState<Row[]>([]);
  const load = useCallback(async () => setSwaps((await apiGet("/api/swaps").catch(() => ({ swaps: [] }))).swaps || []), []);
  useEffect(() => { load(); }, [load]);
  async function claim(swapId: string) { await apiPost("/api/swaps", { action: "claim", swapId }); load(); onChange(); }
  if (swaps.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-ink-light">Shift swap board</h3>
      {swaps.map((s) => <div key={s.swapId} className="card flex items-center justify-between"><div><div className="font-medium text-ink">{s.serviceName} <span className="text-ink-light">for {s.recipientName}</span></div><div className="text-xs text-ink-light">{s.start ? new Date(s.start).toLocaleString() : ""} · posted by {s.fromName}{s.reason ? ` · ${s.reason}` : ""}</div></div><button onClick={() => claim(s.swapId)} className="btn-primary btn-sm">Take shift</button></div>)}
    </div>
  );
}
