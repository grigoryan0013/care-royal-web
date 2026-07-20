"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { publicPost } from "../lib/session";

const SERVICES = ["Personal & senior care", "Companion & non-medical", "Skilled home health", "Child care", "Pet care", "Household & home services", "Transportation"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ApplyPage() {
  const [code, setCode] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [avail, setAvail] = useState<string[]>([]);
  const [f, setF] = useState({ name: "", email: "", phone: "", city: "", zip: "", credentials: "", experience: "", details: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState<string | null>(null);

  useEffect(() => { if (typeof window !== "undefined") setCode((new URLSearchParams(window.location.search).get("a") || "").toUpperCase()); }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const tog = (arr: string[], setArr: (v: string[]) => void, s: string) => setArr(arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const r = await publicPost("/api/apply", { code, services, availability: avail, ...f }); setDone((r as { agency?: string }).agency || "the agency"); }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : "Something went wrong."); } finally { setBusy(false); }
  }

  if (done) return (
    <main className="app-bg flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card max-w-md text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-ok/10 text-ok"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></div>
        <h1 className="font-serif text-2xl text-ink">Application received</h1>
        <p className="mt-2 text-sm text-ink-mid">Thank you, {f.name || "there"}. {done} will review your application and reach out about next steps.</p>
        <Link href="/" className="btn-primary mt-6 inline-flex">Back to home</Link>
      </div>
    </main>
  );

  const field = "field";
  return (
    <main className="app-bg min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-2xl font-semibold text-brand">The Care Royal</Link>
        <Link href="/login/" className="btn-ghost btn-sm">Sign in</Link>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Join our care team</p>
          <h1 className="mt-1 font-serif text-4xl text-ink">Apply to be a caregiver</h1>
          <p className="mt-2 text-ink-mid">No account needed to apply. Tell us about your experience and availability.</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div className="card space-y-4">
            <h2 className="font-serif text-lg text-ink">About you</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Full name</label><input className={field} value={f.name} onChange={set("name")} required /></div>
              <div><label className="label">Phone</label><input className={field} value={f.phone} onChange={set("phone")} required /></div>
              <div><label className="label">Email</label><input type="email" className={field} value={f.email} onChange={set("email")} required /></div>
              <div><label className="label">City</label><input className={field} value={f.city} onChange={set("city")} /></div>
            </div>
            <div><label className="label">Credentials / certifications</label><input className={field} placeholder="e.g. CNA, HHA, CPR, RN" value={f.credentials} onChange={set("credentials")} /></div>
            <div><label className="label">Experience</label><input className={field} placeholder="e.g. 5 years senior & dementia care" value={f.experience} onChange={set("experience")} /></div>
          </div>
          <div className="card space-y-4">
            <h2 className="font-serif text-lg text-ink">What can you do & when?</h2>
            <div><span className="label">Services</span><div className="flex flex-wrap gap-2">{SERVICES.map((s) => <button type="button" key={s} onClick={() => tog(services, setServices, s)} className={services.includes(s) ? "chip-on" : "chip-off"}>{s}</button>)}</div></div>
            <div><span className="label">Availability</span><div className="flex flex-wrap gap-2">{DAYS.map((d) => <button type="button" key={d} onClick={() => tog(avail, setAvail, d)} className={avail.includes(d) ? "chip-on" : "chip-off"}>{d}</button>)}</div></div>
            <div><label className="label">Anything else?</label><textarea className={field} rows={3} value={f.details} onChange={set("details")} /></div>
            <div><label className="label">Agency code {code ? "" : "(optional)"}</label><input className={`${field} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></div>
          </div>
          {err && <p className="rounded-lg border-l-4 border-gold bg-gold/10 px-3.5 py-2.5 text-sm text-ink-mid">{err}</p>}
          <button className="btn-primary btn-lg w-full" disabled={busy}>{busy ? "Sending…" : "Submit application"}</button>
        </form>
      </div>
    </main>
  );
}
