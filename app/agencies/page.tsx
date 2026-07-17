"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp, homeForRole } from "../lib/session";
import Icon, { type IconName } from "../../components/Icon";

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  { icon: "schedule", title: "Scheduling & EVV", body: "One calendar for shifts, clock-ins and coverage — with visit verification built in." },
  { icon: "staff", title: "Staff & recruiting", body: "Manage caregivers, credentials and applicants; managers get their own permissioned access." },
  { icon: "documents", title: "Docs & e-sign", body: "Care plans, agreements and paystubs generated and signed in-app." },
  { icon: "money", title: "Billing & payroll", body: "Invoices and payroll from the same timesheets; connect your own Stripe & QuickBooks." },
];
const SIZES = ["Just starting out", "1–10 caregivers", "11–50 caregivers", "50+ caregivers"];

export default function AgencyInquiry() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [size, setSize] = useState("");
  const [tools, setTools] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 6) { setErr("Choose a password with at least 6 characters."); return; }
    setBusy(true);
    try {
      const u = await signUp({ role: "agency", agencyName, name, email, password, phone, onboarding: { intent: "agency_inquiry", agencyName, size, tools } });
      router.replace(homeForRole(u.role));
    } catch (e2) {
      const m = e2 instanceof Error ? e2.message : "Something went wrong";
      setErr(m.replace("Firebase:", "").replace(/\(auth\/.*\)\.?/, "").trim() || m);
      setBusy(false);
    }
  }

  return (
    <main className="app-bg min-h-screen">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/app/login/" className="font-serif text-xl font-semibold text-ink">The Care Royal</Link>
          <Link href="/app/login/" className="text-sm text-ink-light hover:text-ink">Agency sign in</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-2">
        <div>
          <span className="badge badge-gold">For care agencies</span>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-ink">Software built for the way your agency actually runs.</h1>
          <p className="mt-3 text-ink-light">The Care Royal runs scheduling, staff, family bookings, documents, billing and payroll in one place — white-labeled under your agency&apos;s name. Tell us about your agency and we&apos;ll set you up with a tailored quote.</p>
          <div className="mt-8 space-y-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-light text-brand"><Icon name={b.icon} /></span>
                <div><div className="font-semibold text-ink">{b.title}</div><div className="text-sm text-ink-light">{b.body}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card h-fit">
          <h2 className="font-serif text-2xl text-ink">Inquire about our agency software</h2>
          <p className="mt-1 text-sm text-ink-light">Create your account and our team will follow up with a quote. No charge to get started.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div><label className="label">Agency name</label><input className="field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Sunrise Home Care" required /></div>
            <div><label className="label">Your name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Work email</label><input className="field" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" required /></div>
              <div><label className="label">Phone</label><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" /></div>
            </div>
            <div>
              <label className="label">How big is your agency?</label>
              <div className="flex flex-wrap gap-2">{SIZES.map((s) => <button type="button" key={s} onClick={() => setSize(s)} className={size === s ? "chip-on" : "chip-off"}>{s}</button>)}</div>
            </div>
            <div><label className="label">What are you using today? (optional)</label><input className="field" value={tools} onChange={(e) => setTools(e.target.value)} placeholder="e.g. spreadsheets, another platform" /></div>
            <div><label className="label">Create a password</label><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required /></div>
            {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
            <button className="btn-primary btn-lg w-full" disabled={busy}>{busy ? "Creating your account…" : "Create account & request quote"}</button>
            <p className="text-center text-xs text-ink-light">Your workspace is created right away; our team reviews it and sends your quote.</p>
          </form>
        </div>
      </div>
    </main>
  );
}
