"use client";
import { useEffect, useMemo, useState } from "react";
import SignaturePad from "./SignaturePad";
import { calculateStub, FREQUENCIES } from "../app/lib/tax";

// Care Royal Document Studio — generate & download pay documents (paystub,
// invoice, receipt, verification letter). Client-side only: it produces the
// DOCUMENTS. Care Royal never files taxes or moves money.

type DocType = "paystub" | "invoice" | "receipt" | "letter" | "careplan";
interface Company { name: string; ein: string; address: string; phone: string; email: string }
interface Caregiver { userId: string; name: string; email: string }
interface Item { desc: string; qty: string; rate: string }

const usd = (n: number) => "$" + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

const TYPES: { key: DocType; label: string }[] = [
  { key: "paystub", label: "Paystub" },
  { key: "invoice", label: "Invoice" },
  { key: "receipt", label: "Receipt" },
  { key: "letter", label: "Verification letter" },
  { key: "careplan", label: "Care plan" },
];

export default function DocStudio({ tenantId, tenantName, caregivers = [], defaultEmployee }: { tenantId: string; tenantName?: string; caregivers?: Caregiver[]; defaultEmployee?: string }) {
  const CO_KEY = `cr_studio_company_${tenantId}`;
  const SIG_KEY = `cr_studio_sig_${tenantId}`;

  const [type, setType] = useState<DocType>("paystub");
  const [company, setCompany] = useState<Company>({ name: tenantName || "", ein: "", address: "", phone: "", email: "" });
  const [editCo, setEditCo] = useState(false);
  const [sig, setSig] = useState("");
  const [signing, setSigning] = useState(false);

  // paystub
  const [emp, setEmp] = useState(defaultEmployee || "");
  const [empAddr, setEmpAddr] = useState("");
  const [ssn, setSsn] = useState("");
  const [annual, setAnnual] = useState("52000");
  const [freq, setFreq] = useState("biweekly");
  const [periodNo, setPeriodNo] = useState("1");
  const [payDate, setPayDate] = useState("");
  const [exFed, setExFed] = useState(false);
  const [exCa, setExCa] = useState(false);
  // invoice / receipt
  const [billTo, setBillTo] = useState("");
  const [items, setItems] = useState<Item[]>([{ desc: "", qty: "1", rate: "" }]);
  const [docNo, setDocNo] = useState("");
  const [method, setMethod] = useState("Card");
  // letter
  const [position, setPosition] = useState("Caregiver");
  const [startDate, setStartDate] = useState("");
  const [recipient, setRecipient] = useState("To whom it may concern");
  // care plan
  const [conditions, setConditions] = useState("");
  const [goals, setGoals] = useState("Maintain safety and independence at home; support daily activities; monitor wellbeing and communicate changes to the family.");

  useEffect(() => {
    try { const c = localStorage.getItem(CO_KEY); if (c) setCompany(JSON.parse(c)); else setCompany((p) => ({ ...p, name: tenantName || p.name })); } catch { /* */ }
    setSig(localStorage.getItem(SIG_KEY) || "");
  }, [CO_KEY, SIG_KEY, tenantName]);

  function saveCompany() { localStorage.setItem(CO_KEY, JSON.stringify(company)); setEditCo(false); }
  function onSign(signature: string) { setSig(signature); localStorage.setItem(SIG_KEY, signature); setSigning(false); }

  const stub = useMemo(() => calculateStub({ annual: parseFloat(annual) || 0, freq, periodNumber: parseInt(periodNo) || 1, exemptFederal: exFed, exemptCA: exCa }), [annual, freq, periodNo, exFed, exCa]);
  const itemsTotal = items.reduce((a, it) => a + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0);

  const html = useMemo(() => renderDoc(type, {
    company, sig, emp, empAddr, ssn, freq, payDate, periodNo, stub,
    billTo, items, docNo, method, itemsTotal, position, startDate, recipient, annual, conditions, goals,
  }), [type, company, sig, emp, empAddr, ssn, freq, payDate, periodNo, stub, billTo, items, docNo, method, itemsTotal, position, startDate, recipient, annual, conditions, goals]);

  function download() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${TYPES.find((t) => t.key === type)?.label}</title></head><body style="margin:0">${html}<script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }

  const field = "field";
  return (
    <div className="space-y-4">
      {/* type tabs */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => <button key={t.key} onClick={() => setType(t.key)} className={type === t.key ? "chip-on" : "chip-off"}>{t.label}</button>)}
      </div>

      {/* business details */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink">Business details</h3>
          <button onClick={() => setEditCo((v) => !v)} className="btn-ghost btn-sm">{editCo ? "Done" : company.name ? "Edit" : "Add"}</button>
        </div>
        {editCo ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className={field} placeholder="Agency name" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
            <input className={field} placeholder="EIN (00-0000000)" value={company.ein} onChange={(e) => setCompany({ ...company, ein: e.target.value })} />
            <input className={`${field} sm:col-span-2`} placeholder="Address" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            <input className={field} placeholder="Phone" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
            <input className={field} placeholder="Email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
            <button onClick={saveCompany} className="btn-primary sm:col-span-2">Save business details</button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-light">{company.name || "Add your agency's name, EIN and address"}{company.ein ? ` · EIN ${company.ein}` : ""}</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* form */}
        <div className="card space-y-3">
          {type === "paystub" && (
            <>
              <div><label className="label">Employee</label>
                {caregivers.length > 0 ? (
                  <select className={field} value={emp} onChange={(e) => setEmp(e.target.value)}>
                    <option value="">Select or type below</option>
                    {caregivers.map((c) => <option key={c.userId} value={c.name}>{c.name || c.email}</option>)}
                  </select>
                ) : null}
                <input className={`${field} mt-2`} placeholder="Employee name" value={emp} onChange={(e) => setEmp(e.target.value)} />
              </div>
              <input className={field} placeholder="Employee address" value={empAddr} onChange={(e) => setEmpAddr(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className={field} placeholder="SSN last 4" maxLength={4} value={ssn} onChange={(e) => setSsn(e.target.value.replace(/\D/g, ""))} />
                <input className={field} type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Annual $</label><input className={field} value={annual} onChange={(e) => setAnnual(e.target.value)} /></div>
                <div><label className="label">Frequency</label><select className={field} value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
                <div><label className="label">Period #</label><input className={field} value={periodNo} onChange={(e) => setPeriodNo(e.target.value.replace(/\D/g, ""))} /></div>
              </div>
              <div className="flex gap-4 text-sm text-ink-mid">
                <label className="flex items-center gap-1"><input type="checkbox" checked={exFed} onChange={(e) => setExFed(e.target.checked)} /> Fed exempt</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={exCa} onChange={(e) => setExCa(e.target.checked)} /> CA exempt</label>
              </div>
              <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">Net this period: <b>{usd(stub.net)}</b> · Gross {usd(stub.gross.current)}</p>
            </>
          )}

          {(type === "invoice" || type === "receipt") && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input className={field} placeholder={type === "receipt" ? "Received from" : "Bill to"} value={billTo} onChange={(e) => setBillTo(e.target.value)} />
                <input className={field} placeholder={type === "invoice" ? "Invoice #" : "Receipt #"} value={docNo} onChange={(e) => setDocNo(e.target.value)} />
              </div>
              {type === "receipt" && <input className={field} placeholder="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} />}
              <label className="label">Line items</label>
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input className={`${field} flex-1`} placeholder="Description" value={it.desc} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
                  <input className={`${field} w-16`} placeholder="Qty" value={it.qty} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} />
                  <input className={`${field} w-24`} placeholder="Rate" value={it.rate} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} />
                  <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-ink-light hover:text-danger">×</button>
                </div>
              ))}
              <button onClick={() => setItems([...items, { desc: "", qty: "1", rate: "" }])} className="btn-ghost btn-sm">+ Add line</button>
              <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">Total: <b>{usd(itemsTotal)}</b></p>
            </>
          )}

          {type === "letter" && (
            <>
              <input className={field} placeholder="Employee name" value={emp} onChange={(e) => setEmp(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className={field} placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
                <input className={field} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Annual $</label><input className={field} value={annual} onChange={(e) => setAnnual(e.target.value)} /></div>
                <div><label className="label">Frequency</label><select className={field} value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
              </div>
              <input className={field} placeholder="Addressed to" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </>
          )}

          {type === "careplan" && (
            <>
              <input className={field} placeholder="Care recipient name" value={emp} onChange={(e) => setEmp(e.target.value)} />
              <div><label className="label">Conditions / needs</label><textarea className={field} rows={2} value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. limited mobility, diabetes, early dementia" /></div>
              <div><label className="label">Care goals (draft — edit freely)</label><textarea className={field} rows={4} value={goals} onChange={(e) => setGoals(e.target.value)} /></div>
            </>
          )}

          <div className="border-t border-rule pt-3">
            {sig ? (
              <div className="flex items-center gap-3">
                {sig.startsWith("data:image") ? <img src={sig} alt="signature" className="h-10 rounded border border-rule bg-white px-2" /> : <span className="font-serif text-xl text-ink">{sig}</span>}
                <button onClick={() => setSigning(true)} className="text-xs font-semibold text-ink-light hover:text-brand">Change signature</button>
              </div>
            ) : signing ? <SignaturePad onSign={onSign} /> : <button onClick={() => setSigning(true)} className="btn-ghost btn-sm">Add authorized signature</button>}
          </div>

          <button onClick={download} className="btn-primary w-full">Download PDF</button>
          <p className="hint">Paystub figures are estimates for document purposes — Care Royal does not file taxes or move money.</p>
        </div>

        {/* live preview */}
        <div className="overflow-auto rounded-xl2 border border-rule bg-ink/5 p-3">
          <div className="mx-auto max-w-[560px] bg-white shadow-card" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}

// -------- document renderer (inline styles so preview == printed PDF) --------
interface RenderData {
  company: Company; sig: string; emp: string; empAddr: string; ssn: string; freq: string; payDate: string; periodNo: string;
  stub: ReturnType<typeof calculateStub>; billTo: string; items: Item[]; docNo: string; method: string; itemsTotal: number;
  position: string; startDate: string; recipient: string; annual: string; conditions: string; goals: string;
}

function sigBlock(d: RenderData) {
  const s = d.sig ? (d.sig.startsWith("data:image") ? `<img src="${d.sig}" style="height:52px"/>` : `<div style="font-family:'Fraunces',Georgia,serif;font-size:24px">${esc(d.sig)}</div>`) : "";
  return `<div style="margin-top:36px">${s}<div style="border-top:1px solid #14181B;width:220px;margin-top:4px;padding-top:4px;font-size:11px;color:#57636C">Authorized signature — ${esc(d.company.name || "")}</div></div>`;
}
function head(d: RenderData) {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4B39EF;padding-bottom:12px;margin-bottom:20px">
    <div><div style="font-family:'Fraunces',Georgia,serif;font-size:22px;color:#4B39EF;font-weight:600">${esc(d.company.name || "Your Agency")}</div>
    <div style="font-size:11px;color:#57636C;line-height:1.5">${esc(d.company.address || "")}${d.company.phone ? "<br>" + esc(d.company.phone) : ""}${d.company.email ? "<br>" + esc(d.company.email) : ""}${d.company.ein ? "<br>EIN " + esc(d.company.ein) : ""}</div></div>
  </div>`;
}
const wrap = (inner: string) => `<div style="font-family:Inter,system-ui,sans-serif;color:#14181B;padding:40px;font-size:13px;line-height:1.55">${inner}</div>`;

function renderDoc(type: DocType, d: RenderData): string {
  if (type === "paystub") {
    const rows = d.stub.taxes.map((t) => `<tr><td style="padding:4px 0">${t.label}</td><td style="text-align:right">${usd(t.current)}</td><td style="text-align:right;color:#57636C">${usd(t.ytd)}</td></tr>`).join("");
    return wrap(head(d) + `
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">Employee</div><div style="font-weight:600">${esc(d.emp || "—")}</div><div style="font-size:11px;color:#57636C">${esc(d.empAddr)}${d.ssn ? "<br>SSN •••-••-" + esc(d.ssn) : ""}</div></div>
        <div style="text-align:right"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">Pay stub</div><div style="font-size:11px;color:#57636C">Pay date ${esc(d.payDate || "—")}<br>${(FREQUENCIES.find((f) => f.key === d.freq)?.label) || ""} · period ${esc(d.periodNo)}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="text-align:left;color:#8b95a1;font-size:10px;text-transform:uppercase;letter-spacing:.06em"><th style="padding-bottom:4px">Earnings & deductions</th><th style="text-align:right">Current</th><th style="text-align:right">YTD</th></tr>
        <tr style="font-weight:600"><td style="padding:4px 0">Gross pay</td><td style="text-align:right">${usd(d.stub.gross.current)}</td><td style="text-align:right;color:#57636C">${usd(d.stub.gross.ytd)}</td></tr>
        ${rows}
        <tr style="border-top:2px solid #14181B;font-weight:700"><td style="padding:8px 0">Net pay</td><td style="text-align:right">${usd(d.stub.net)}</td><td style="text-align:right;color:#57636C">${usd(d.stub.netYtd)}</td></tr>
      </table>
      <div style="margin-top:10px;font-size:10px;color:#8b95a1">Withholding figures are estimates for documentation only and are not an official tax filing.</div>
      ${sigBlock(d)}`);
  }
  if (type === "invoice" || type === "receipt") {
    const rows = d.items.map((it) => { const amt = (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0); return `<tr><td style="padding:6px 0">${esc(it.desc)}</td><td style="text-align:right">${esc(it.qty)}</td><td style="text-align:right">${usd(parseFloat(it.rate) || 0)}</td><td style="text-align:right">${usd(amt)}</td></tr>`; }).join("");
    const title = type === "invoice" ? "Invoice" : "Receipt";
    return wrap(head(d) + `
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">${type === "receipt" ? "Received from" : "Bill to"}</div><div style="font-weight:600">${esc(d.billTo || "—")}</div></div>
        <div style="text-align:right"><div style="font-family:'Fraunces',Georgia,serif;font-size:20px;color:#4B39EF">${title}</div><div style="font-size:11px;color:#57636C">${esc(d.docNo)}${type === "receipt" ? "<br>Paid by " + esc(d.method) : ""}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="text-align:left;color:#8b95a1;font-size:10px;text-transform:uppercase;letter-spacing:.06em"><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr>
        ${rows}
        <tr style="border-top:2px solid #14181B;font-weight:700"><td colspan="3" style="padding:8px 0">${type === "receipt" ? "Total paid" : "Total due"}</td><td style="text-align:right">${usd(d.itemsTotal)}</td></tr>
      </table>
      ${type === "receipt" ? '<div style="margin-top:20px;color:#1f9d55;font-weight:600">Paid — thank you.</div>' : ""}
      ${sigBlock(d)}`);
  }
  if (type === "careplan") {
    return wrap(head(d) + `
      <div style="font-family:'Fraunces',Georgia,serif;font-size:20px;color:#4B39EF;margin-bottom:4px">Care Plan</div>
      <div style="color:#57636C;font-size:11px;margin-bottom:16px">Prepared ${new Date().toLocaleDateString()}</div>
      <div style="margin-bottom:12px"><span style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">Care recipient</span><div style="font-weight:600">${esc(d.emp || "—")}</div></div>
      <div style="margin-bottom:12px"><span style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">Conditions & needs</span><div>${esc(d.conditions) || "—"}</div></div>
      <div style="margin-bottom:12px"><span style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8b95a1">Care goals</span><div style="white-space:pre-wrap">${esc(d.goals)}</div></div>
      <div style="margin-top:8px;font-size:10px;color:#8b95a1">This care plan is a draft to be reviewed and approved with the family.</div>
      ${sigBlock(d)}`);
  }
  // letter
  const freqLabel = (FREQUENCIES.find((f) => f.key === d.freq)?.label || "").toLowerCase();
  return wrap(head(d) + `
    <div style="color:#57636C;font-size:11px;margin-bottom:16px">${new Date().toLocaleDateString()}</div>
    <div style="margin-bottom:12px">${esc(d.recipient)},</div>
    <p style="margin:0 0 12px">This letter confirms that <b>${esc(d.emp || "the employee")}</b> is employed by ${esc(d.company.name || "our agency")} as a <b>${esc(d.position)}</b>${d.startDate ? `, since ${esc(d.startDate)}` : ""}.</p>
    <p style="margin:0 0 12px">Their current gross compensation is <b>${usd(parseFloat(d.annual) || 0)}</b> per year, paid ${freqLabel}.</p>
    <p style="margin:0 0 12px">Please contact us at ${esc(d.company.phone || d.company.email || "our office")} with any questions regarding this verification.</p>
    <p style="margin:0 0 4px">Sincerely,</p>
    ${sigBlock(d)}`);
}
