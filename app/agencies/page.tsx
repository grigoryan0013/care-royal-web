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
  const [step, setStep] = useState(1);
  const TOTAL = 4;
  const STEPS = [
    { n: 1, label: "About you" },
    { n: 2, label: "Your agency" },
    { n: 3, label: "Your care" },
    { n: 4, label: "Finish" },
  ];

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function choosePlan(key: string) {
    setPlan(key);
    setStep(1);
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  }

  function stepValid(s: number) {
    if (s === 1) return !!name.trim() && /\S+@\S+\.\S+/.test(email) && !!phone.trim();
    if (s === 2) return !!agencyName.trim();
    return true;
  }
  function next() {
    setErr("");
    if (!stepValid(step)) { setErr("Please fill in the required fields to continue."); return; }
    setStep((s) => Math.min(TOTAL, s + 1));
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  }
  function back() { setErr(""); setStep((s) => Math.max(1, s - 1)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Enter key mid-wizard advances instead of submitting early.
    if (step < TOTAL) { next(); return; }
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
    <main className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-deep/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2 text-white">
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logo.png`} alt="The Care Royal" className="h-9 w-9 rounded-full bg-white object-cover ring-1 ring-white/25" />
            <span className="font-serif text-lg font-bold tracking-tight">The Care Royal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login/" className="rounded-xl px-3.5 py-2 text-sm font-semibold text-white/85 hover:text-white">Agency sign in</Link>
            <a href="#signup" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand shadow-sm transition hover:shadow-pop">Start free</a>
          </div>
        </div>
      </header>

      {/* Hero — Flutter-landing gradient */}
      <section className="hero-gradient relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-32 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">For home-care agencies</span>
          <h1 className="mx-auto mt-5 max-w-3xl font-serif text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">Run your entire agency<br className="hidden sm:block" /> in one place.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/80 sm:text-lg">Scheduling, caregivers, family bookings, care documents, payments and payroll — white-labeled under your agency&apos;s name. The modern alternative to care.com, built for how agencies actually run.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#signup" className="rounded-xl bg-white px-6 py-3 text-base font-bold text-brand shadow-pop transition hover:-translate-y-0.5">Start {TRIAL_DAYS}-day free trial</a>
            <a href="#pricing" className="rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10">See plans</a>
          </div>
          <p className="mt-5 text-sm text-white/70">No card required · Your workspace is ready in under a minute</p>
        </div>
      </section>

      {/* Benefit cards overlapping the hero */}
      <section className="relative z-10 mx-auto -mt-20 max-w-6xl px-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card card-hover text-left">
              <span className="icon-badge"><Icon name={b.icon} /></span>
              <div className="mt-4 font-serif text-lg font-bold text-ink">{b.title}</div>
              <div className="mt-1 text-sm text-ink-light">{b.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
        <div className="text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="mt-4 font-serif text-3xl font-black tracking-tight text-ink sm:text-4xl">Simple, honest <span className="text-gradient">pricing</span></h2>
          <p className="mt-3 text-ink-light">Every plan includes a {TRIAL_DAYS}-day free trial. Cancel anytime.</p>
        </div>
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.key} className={`relative flex flex-col rounded-xl2 bg-white p-7 transition ${p.popular ? "border-2 border-brand shadow-brand lg:-mt-4 lg:pb-9" : "border border-rule shadow-card lift"}`}>
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-brand" style={{ background: "linear-gradient(120deg,#4B39EF,#673AB7)" }}>Most popular</span>
              )}
              <h3 className="font-serif text-xl font-bold text-ink">{p.name}</h3>
              <p className="mt-1 text-sm text-ink-light">{p.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-serif text-5xl font-black tracking-tight text-ink">${p.price}</span>
                <span className="text-ink-light">/mo</span>
              </div>
              <div className="mt-2 inline-flex w-fit rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink-mid">{p.caregivers}</div>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-ink-mid">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-check/15"><Icon name="check" size={13} className="text-check" /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => choosePlan(p.key)} className={`mt-7 w-full ${p.popular ? "btn-gradient btn-lg" : "btn-ghost btn-lg"}`}>Start free trial</button>
            </div>
          ))}
        </div>
      </section>

      {/* Signup wizard */}
      <section id="signup" className="pricing-band">
        <div className="mx-auto max-w-2xl px-5 py-20">
          <div className="card">
            <h2 className="font-serif text-2xl font-bold text-ink">Join The Care Royal</h2>
            <p className="mt-1 text-sm text-ink-light">A few quick steps and your workspace is ready. Plan: <b className="text-ink">{PLANS.find((p) => p.key === plan)?.name}</b> — starts after your {TRIAL_DAYS}-day free trial.</p>

            {/* Progress */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                {STEPS.map((s) => (
                  <div key={s.n} className={`flex items-center gap-2 text-xs font-semibold ${step >= s.n ? "text-brand" : "text-ink-light"}`}>
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] transition ${step >= s.n ? "text-white" : "bg-paper text-ink-light"}`} style={step >= s.n ? { background: "linear-gradient(120deg,#4B39EF,#673AB7)" } : undefined}>
                      {step > s.n ? <Icon name="check" size={12} /> : s.n}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(step / TOTAL) * 100}%`, background: "linear-gradient(120deg,#4B39EF,#673AB7)" }} />
              </div>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-5">
              {/* Step 1 — About you */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div><label className="label">Your name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" autoFocus /></div>
                  <div><label className="label">Work email</label><input className="field" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" /></div>
                  <div><label className="label">Phone</label><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" /></div>
                </div>
              )}

              {/* Step 2 — Your agency */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="label">Agency name</label><input className="field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Sunrise Home Care" autoFocus /></div>
                    <div><label className="label">State</label><input className="field" value={state} onChange={(e) => setState(e.target.value)} placeholder="California" /></div>
                  </div>
                  <div>
                    <label className="label">How big is your agency?</label>
                    <div className="flex flex-wrap gap-2">{SIZES.map((s) => <button type="button" key={s} onClick={() => setSize(s)} className={size === s ? "chip-on" : "chip-off"}>{s}</button>)}</div>
                  </div>
                </div>
              )}

              {/* Step 3 — Your care */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
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
                </div>
              )}

              {/* Step 4 — Finish */}
              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="label">Your role</label>
                    <select className="field" value={title} onChange={(e) => setTitle(e.target.value)}>
                      <option value="">Select…</option>
                      {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Create a password</label><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoFocus /></div>
                  <div>
                    <label className="label">How did you hear about us? (optional)</label>
                    <div className="flex flex-wrap gap-2">{HEARD.map((h) => <button type="button" key={h} onClick={() => setHeardFrom(h)} className={heardFrom === h ? "chip-on" : "chip-off"}>{h}</button>)}</div>
                  </div>
                  <label className="flex items-start gap-2 text-sm text-ink-mid">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
                    <span>I agree to the <Link href="/terms/" className="text-brand">Terms of Service</Link> and <Link href="/privacy/" className="text-brand">Privacy Notice</Link>.</span>
                  </label>
                </div>
              )}

              {err && (
                <div className="rounded-lg border-l-4 border-gold bg-gold/10 px-3.5 py-2.5 text-sm text-ink-mid">
                  {err}
                  {exists && <> <Link href="/login/" className="font-semibold text-brand">Sign in or reset your password</Link></>}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                {step > 1 && <button type="button" onClick={back} className="btn-ghost btn-lg">Back</button>}
                {step < TOTAL ? (
                  <button type="button" onClick={next} className="btn-gradient btn-lg flex-1">Continue</button>
                ) : (
                  <button className="btn-gradient btn-lg flex-1" disabled={busy}>{busy ? "Creating your workspace…" : `Start my ${TRIAL_DAYS}-day free trial`}</button>
                )}
              </div>
              {step === TOTAL && <p className="text-center text-xs text-ink-light">Your workspace is created instantly. No charge during your {TRIAL_DAYS}-day trial — cancel anytime.</p>}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
