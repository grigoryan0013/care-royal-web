"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { signUp, homeForRole, authErrorMessage, isAccountExistsError, lookupAccountType } from "../lib/session";
import { db } from "../lib/firebase";
import { PLANS, TRIAL_DAYS } from "../lib/plans";
import Icon, { type IconName } from "../../components/Icon";

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  { icon: "schedule", title: "Scheduling & clock-in", body: "One calendar for shifts, GPS clock-in and coverage." },
  { icon: "staff", title: "Staff & recruiting", body: "Caregivers, credentials and applicants; managers get permissioned access." },
  { icon: "documents", title: "Docs & e-sign", body: "Care plans, agreements and paystubs generated and signed in-app." },
  { icon: "money", title: "Billing & payroll", body: "Invoices and payroll from the same timesheets; connect your own Stripe & QuickBooks." },
];
const SIZES = ["Just starting out", "1–10 caregivers", "11–50 caregivers", "50+ caregivers"];
const TITLES = ["Owner", "Administrator", "Director of Nursing", "Scheduler / Coordinator", "Other"];
const CARE_TYPES = ["Senior care", "Disability support", "Post-surgery", "Dementia / Alzheimer's", "Pediatric", "Hospice support"];
const SERVICES = ["Personal care", "Companionship", "Homemaking", "Skilled nursing", "Respite care", "Medication reminders", "Transportation", "Live-in care"];
const HEARD = ["Google search", "Referral", "Social media", "Industry event", "Other"];

export default function JoinAgency() {
  const router = useRouter();
  const [plan, setPlan] = useState("pro");
  // account
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // profile
  const [state, setState] = useState("");
  const [size, setSize] = useState("");
  const [caregiverCount, setCaregiverCount] = useState("");
  const [clientCount, setClientCount] = useState("");
  const [careTypes, setCareTypes] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [tools, setTools] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [agree, setAgree] = useState(false);
  // ui
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [exists, setExists] = useState(false);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function choosePlan(key: string) {
    setPlan(key);
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setExists(false);
    if (password.length < 6) { setErr("Please choose a password with at least 6 characters."); return; }
    if (!agree) { setErr("Please agree to the Terms and Privacy Notice to continue."); return; }
    setBusy(true);
    try {
      const u = await signUp({
        role: "agency", agencyName, name, email, password, phone,
        onboarding: { intent: "agency_signup", agencyName, plan, title, state, size, caregiverCount, clientCount, careTypes, services, tools, heardFrom },
      });
      // Persist the detailed profile on the tenant (owner can now write it). Non-fatal.
      try {
        await updateDoc(doc(db(), "tenants", u.tenantId), {
          selectedPlan: plan,
          profile: { title, state, size, caregiverCount, clientCount, careTypes, services, tools, heardFrom },
        });
      } catch { /* profile is a nice-to-have; don't block onboarding */ }
      router.replace(homeForRole(u.role));
    } catch (e2) {
      if (isAccountExistsError(e2)) {
        const t = await lookupAccountType(email);
        setErr(t ? `That email already has a ${t} account. Please sign in or reset your password.` : authErrorMessage(e2));
        setExists(true);
      } else {
        setErr(authErrorMessage(e2));
      }
      setBusy(false);
    }
  }

  return (
    <main className="app-bg min-h-screen">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/login/" className="font-serif text-xl font-semibold text-ink">The Care Royal</Link>
          <Link href="/login/" className="text-sm text-ink-light hover:text-ink">Agency sign in</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-6 text-center">
        <span className="badge badge-gold">For home-care agencies</span>
        <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl leading-tight text-ink sm:text-5xl">Run your entire agency in one place.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink-light">Scheduling, caregivers, family bookings, care documents, payments and payroll — white-labeled under your agency&apos;s name. Start free for {TRIAL_DAYS} days. No card charged until your trial ends.</p>
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card text-left">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-light text-brand"><Icon name={b.icon} /></span>
              <div className="mt-3 font-semibold text-ink">{b.title}</div>
              <div className="mt-1 text-sm text-ink-light">{b.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-center font-serif text-3xl text-ink">Simple, honest pricing</h2>
        <p className="mt-2 text-center text-ink-light">Every plan includes a {TRIAL_DAYS}-day free trial. Cancel anytime.</p>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.key} className={`card flex flex-col ${p.popular ? "ring-2 ring-brand" : ""}`}>
              {p.popular && <span className="badge badge-brand mb-2 self-start">Most popular</span>}
              <h3 className="font-serif text-2xl text-ink">{p.name}</h3>
              <p className="mt-1 text-sm text-ink-light">{p.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1"><span className="font-serif text-4xl text-ink">${p.price}</span><span className="text-ink-light">/mo</span></div>
              <div className="mt-1 text-sm font-medium text-ink-mid">{p.caregivers}</div>
              <ul className="mt-5 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-ink-mid"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-ok" />{f}</li>
                ))}
              </ul>
              <button onClick={() => choosePlan(p.key)} className={`mt-6 w-full ${p.popular ? "btn-primary" : "btn-soft"}`}>Start {TRIAL_DAYS}-day free trial</button>
            </div>
          ))}
        </div>
      </section>

      {/* Signup + onboarding */}
      <section id="signup" className="mx-auto max-w-3xl px-5 py-12">
        <div className="card">
          <h2 className="font-serif text-2xl text-ink">Join The Care Royal</h2>
          <p className="mt-1 text-sm text-ink-light">Tell us about your agency and we&apos;ll set up your workspace instantly. Selected plan: <b className="text-ink">{PLANS.find((p) => p.key === plan)?.name}</b> — starts after your {TRIAL_DAYS}-day free trial.</p>

          <form onSubmit={submit} className="mt-6 space-y-7">
            {/* Your agency */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-ink-light">Your agency</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Agency name</label><input className="field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Sunrise Home Care" required /></div>
                <div><label className="label">State</label><input className="field" value={state} onChange={(e) => setState(e.target.value)} placeholder="California" /></div>
              </div>
              <div>
                <label className="label">How big is your agency?</label>
                <div className="flex flex-wrap gap-2">{SIZES.map((s) => <button type="button" key={s} onClick={() => setSize(s)} className={size === s ? "chip-on" : "chip-off"}>{s}</button>)}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Active caregivers (approx.)</label><input className="field" inputMode="numeric" value={caregiverCount} onChange={(e) => setCaregiverCount(e.target.value)} placeholder="e.g. 12" /></div>
                <div><label className="label">Active clients (approx.)</label><input className="field" inputMode="numeric" value={clientCount} onChange={(e) => setClientCount(e.target.value)} placeholder="e.g. 20" /></div>
              </div>
              <div>
                <label className="label">Types of care you provide</label>
                <div className="flex flex-wrap gap-2">{CARE_TYPES.map((c) => <button type="button" key={c} onClick={() => toggle(careTypes, setCareTypes, c)} className={careTypes.includes(c) ? "chip-on" : "chip-off"}>{c}</button>)}</div>
              </div>
              <div>
                <label className="label">Services you offer</label>
                <div className="flex flex-wrap gap-2">{SERVICES.map((s) => <button type="button" key={s} onClick={() => toggle(services, setServices, s)} className={services.includes(s) ? "chip-on" : "chip-off"}>{s}</button>)}</div>
              </div>
              <div><label className="label">What are you using today? (optional)</label><input className="field" value={tools} onChange={(e) => setTools(e.target.value)} placeholder="e.g. spreadsheets, AxisCare, pen & paper" /></div>
            </fieldset>

            {/* You */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold uppercase tracking-wide text-ink-light">Your account</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Your name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required /></div>
                <div>
                  <label className="label">Your role</label>
                  <select className="field" value={title} onChange={(e) => setTitle(e.target.value)}>
                    <option value="">Select…</option>
                    {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Work email</label><input className="field" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" required /></div>
                <div><label className="label">Phone</label><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" required /></div>
              </div>
              <div><label className="label">Create a password</label><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required /></div>
              <div>
                <label className="label">How did you hear about us? (optional)</label>
                <div className="flex flex-wrap gap-2">{HEARD.map((h) => <button type="button" key={h} onClick={() => setHeardFrom(h)} className={heardFrom === h ? "chip-on" : "chip-off"}>{h}</button>)}</div>
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-sm text-ink-mid">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              <span>I agree to the <Link href="/terms/" className="text-brand">Terms of Service</Link> and <Link href="/privacy/" className="text-brand">Privacy Notice</Link>.</span>
            </label>

            {err && (
              <div className="rounded-lg border-l-4 border-gold bg-gold/10 px-3.5 py-2.5 text-sm text-ink-mid">
                {err}
                {exists && <> <Link href="/login/" className="font-semibold text-brand">Sign in or reset your password</Link></>}
              </div>
            )}

            <button className="btn-primary btn-lg w-full" disabled={busy}>{busy ? "Creating your workspace…" : `Start my ${TRIAL_DAYS}-day free trial`}</button>
            <p className="text-center text-xs text-ink-light">Your workspace is created instantly. No charge during your {TRIAL_DAYS}-day trial — cancel anytime before it ends.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
