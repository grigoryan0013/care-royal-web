"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { publicPost } from "../lib/session";

const SERVICES = [
  "Personal & senior care", "Companion & non-medical", "Skilled home health",
  "Specialized condition care", "Child care", "Pet care",
  "Household & home services", "Respite & family support", "Transportation", "Wellness",
];
const FREQ = ["One-time", "A few times a week", "Daily", "Live-in / 24-hour", "Overnight", "Not sure yet"];

export default function QuotePage() {
  const [code, setCode] = useState("");
  const [careFor, setCareFor] = useState("person");
  const [services, setServices] = useState<string[]>([]);
  const [f, setF] = useState({ name: "", email: "", phone: "", city: "", zip: "", recipientName: "", frequency: "", startDate: "", schedule: "", details: "", bestTime: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { if (typeof window !== "undefined") setCode((new URLSearchParams(window.location.search).get("a") || "").toUpperCase()); }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const toggleSvc = (s: string) => setServices((v) => v.includes(s) ? v.filter((x) => x !== s) : [...v, s]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await publicPost("/api/quote", { code, careFor, services, ...f });
      setDone((r as { agency?: string }).agency || "the agency");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  if (done) return (
    <main className="app-bg flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card max-w-md text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-ok/10 text-ok"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
        <h1 className="font-serif text-2xl text-ink">Request received</h1>
        <p className="mt-2 text-sm text-ink-mid">Thank you, {f.name || "there"}. {done} will review your care request and reach out{f.bestTime ? ` (${f.bestTime.toLowerCase()})` : ""} to build your care plan and quote.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">Back to home</Link>
      </div>
    </main>
  );

  const field = "field";
  return (
    <main className="app-bg min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-2xl font-semibold text-brand">Care Royal</Link>
        <Link href="/login/" className="btn-ghost btn-sm">Agency sign in</Link>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Request a free quote</p>
          <h1 className="mt-1 font-serif text-4xl text-ink">Tell us about the care you need</h1>
          <p className="mt-2 text-ink-mid">No account needed. Fill this out and a care agency will build a personalized plan and quote for you.</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="card space-y-4">
            <h2 className="font-serif text-lg text-ink">Who is the care for?</h2>
            <div className="grid grid-cols-3 gap-2">
              {[["person", "A person"], ["pet", "A pet"], ["home", "A home"]].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setCareFor(k)} className={`rounded-lg border py-2.5 text-sm font-semibold ${careFor === k ? "border-brand bg-brand-light text-brand" : "border-rule-dark text-ink-mid"}`}>{l}</button>
              ))}
            </div>
            <input className={field} placeholder={careFor === "pet" ? "Pet's name & type" : careFor === "home" ? "Property / address nickname" : "Their name & age (e.g. my mother, 82)"} value={f.recipientName} onChange={set("recipientName")} />
          </div>

          <div className="card space-y-4">
            <h2 className="font-serif text-lg text-ink">What kind of care?</h2>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((s) => <button type="button" key={s} onClick={() => toggleSvc(s)} className={services.includes(s) ? "chip-on" : "chip-off"}>{s}</button>)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">How often?</label><select className={field} value={f.frequency} onChange={set("frequency")}><option value="">Select</option>{FREQ.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              <div><label className="label">Ideal start date</label><input type="date" className={field} value={f.startDate} onChange={set("startDate")} /></div>
            </div>
            <div><label className="label">Schedule preferences</label><input className={field} placeholder="e.g. weekday mornings, overnight on weekends" value={f.schedule} onChange={set("schedule")} /></div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-serif text-lg text-ink">Your contact details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Full name</label><input className={field} value={f.name} onChange={set("name")} required /></div>
              <div><label className="label">Phone</label><input className={field} value={f.phone} onChange={set("phone")} required /></div>
              <div><label className="label">Email</label><input type="email" className={field} value={f.email} onChange={set("email")} required /></div>
              <div><label className="label">Best time to reach you</label><input className={field} placeholder="e.g. weekday afternoons" value={f.bestTime} onChange={set("bestTime")} /></div>
              <div><label className="label">City</label><input className={field} value={f.city} onChange={set("city")} /></div>
              <div><label className="label">ZIP</label><input className={field} value={f.zip} onChange={set("zip")} /></div>
            </div>
            <div><label className="label">Anything else we should know?</label><textarea className={field} rows={3} placeholder="Conditions, preferences, questions…" value={f.details} onChange={set("details")} /></div>
            <div><label className="label">Agency code {code ? "" : "(optional)"}</label><input className={`${field} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="If an agency gave you a code" /></div>
          </div>

          {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
          <button className="btn-primary btn-lg w-full" disabled={busy}>{busy ? "Sending…" : "Request my free quote"}</button>
          <p className="text-center text-xs text-ink-light">By submitting you agree to be contacted about your care request. See our <Link href="/privacy/" className="text-brand">privacy policy</Link>.</p>
        </form>
      </div>
    </main>
  );
}
