"use client";
import { useState } from "react";
import Link from "next/link";
import { publicPost } from "./lib/session";

const valueProps = [
  { t: "Care, thoughtfully matched", d: "Tell us what you need and we help connect your family with caregivers suited to your situation." },
  { t: "One place for everything", d: "Scheduling, care updates, documents, and payments — organized and easy for the whole family." },
  { t: "Built for the people you love", d: "Add profiles for parents, children, and pets, and keep everyone on the same page." },
  { t: "For agencies, too", d: "A modern toolset to run scheduling, family bookings, documents, and payments in one platform." },
];

export default function Home() {
  const [tab, setTab] = useState<"direct" | "agency">("direct");

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="font-serif text-2xl font-semibold tracking-tight text-brand">Care Royal</div>
        <nav className="flex items-center gap-3">
          <Link href="/login/" className="text-sm font-semibold text-ink-mid hover:text-brand">Sign in</Link>
          <a href="#waitlist" className="btn-primary">Join the waitlist</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Now forming — reserve your place</p>
        <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] text-ink md:text-6xl">
          Exceptional care, thoughtfully matched.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-mid">
          Care Royal helps families connect with caregivers and gives agencies the tools to
          run modern care — scheduling, family bookings, documents, and payments in one place.
          Join the waitlist and be first when we open in your area.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#waitlist" onClick={() => setTab("direct")} className="btn-primary px-6 py-3">Request care</a>
          <a href="#waitlist" onClick={() => setTab("agency")} className="btn-ghost px-6 py-3">Partner with us</a>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {valueProps.map((f) => (
            <div key={f.t} className="card">
              <h3 className="font-serif text-xl text-ink">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-mid">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist / questionnaires */}
      <section id="waitlist" className="border-t border-rule bg-brand-light/40">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="mb-8 text-center">
            <h2 className="font-serif text-4xl text-ink">Join the waitlist</h2>
            <p className="mt-3 text-ink-mid">Tell us a little about your needs. It takes two minutes and helps us prepare the right care for you.</p>
          </div>

          <div className="mx-auto mb-8 flex max-w-md rounded-lg border border-rule-dark bg-white p-1 text-sm font-semibold">
            <button onClick={() => setTab("direct")} className={`flex-1 rounded-md py-2.5 ${tab === "direct" ? "bg-brand text-white" : "text-ink-mid"}`}>I need care</button>
            <button onClick={() => setTab("agency")} className={`flex-1 rounded-md py-2.5 ${tab === "agency" ? "bg-brand text-white" : "text-ink-mid"}`}>I run an agency</button>
          </div>

          {tab === "direct" ? <DirectForm /> : <AgencyForm />}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-ink-light">
          <p className="max-w-3xl leading-relaxed">
            Care Royal is a technology platform that helps families connect with independent caregivers
            and helps agencies manage care operations. Care Royal is not a healthcare provider and does
            not provide medical advice. Caregivers are engaged by families or their agency. Availability
            varies by area. Nothing on this page is a guarantee of service or outcome.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/privacy/" className="font-semibold text-brand">Privacy Notice</Link>
            <span>© {new Date().getFullYear()} Care Royal</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ---- shared field bits -------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
function Checks({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => toggle(o)}
          className={`rounded-lg border px-3 py-1.5 text-sm ${value.includes(o) ? "border-brand bg-brand-light font-semibold text-brand" : "border-rule-dark text-ink-mid"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
function Consent({ checked, onChange }: { checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-mid">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        I agree that Care Royal may contact me by email, phone, or text about my request. Message and
        data rates may apply. I have read the <Link href="/privacy/" className="font-semibold text-brand">Privacy Notice</Link>.
      </span>
    </label>
  );
}
function ThankYou() {
  return (
    <div className="card text-center">
      <h3 className="font-serif text-2xl text-brand">You're on the list</h3>
      <p className="mt-2 text-sm text-ink-mid">Thank you. We'll reach out as we open in your area. Keep an eye on your inbox.</p>
    </div>
  );
}

async function submit(type: "direct" | "agency", base: Record<string, string>, details: Record<string, unknown>, setState: (s: string) => void, setDone: (b: boolean) => void) {
  setState("");
  if (!base.email || !base.email.includes("@")) { setState("Please enter a valid email."); return; }
  try {
    await publicPost("/api/waitlist", { type, ...base, details });
    setDone(true);
  } catch (e) {
    setState(e instanceof Error ? e.message : "Something went wrong. Please try again.");
  }
}

// ---- Direct (family / individual) form ---------------------------------
function DirectForm() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [region, setRegion] = useState(""); const [who, setWho] = useState(""); const [types, setTypes] = useState<string[]>([]);
  const [hours, setHours] = useState(""); const [timeframe, setTimeframe] = useState(""); const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState(""); const [consent, setConsent] = useState(false);
  const [err, setErr] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);

  if (done) return <ThankYou />;

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) { setErr("Please agree to the Privacy Notice to continue."); return; }
    setBusy(true);
    await submit("direct", { name, email, phone, region, timeframe },
      { whoNeedsCare: who, careTypes: types.join(", "), hoursPerWeek: hours, budget, notes }, setErr, setDone);
    setBusy(false);
  }

  return (
    <form onSubmit={go} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Phone"><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="City or ZIP"><input className="field" value={region} onChange={(e) => setRegion(e.target.value)} /></Field>
      </div>
      <Field label="Who needs care?">
        <select className="field" value={who} onChange={(e) => setWho(e.target.value)} required>
          <option value="">Select</option>
          {["My parent", "My spouse", "My child", "Myself", "A pet", "My home", "Someone else"].map((o) => <option key={o}>{o}</option>)}
        </select>
      </Field>
      <Field label="What kind of care? (choose any)">
        <Checks options={["Personal care", "Companionship", "Skilled nursing", "Dementia care", "Child care", "Pet care", "Housekeeping", "Transportation", "Respite"]} value={types} onChange={setTypes} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Hours per week">
          <select className="field" value={hours} onChange={(e) => setHours(e.target.value)}>
            <option value="">Select</option>{["A few hours", "10–20", "20–40", "40+", "Live-in", "Not sure"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="When to start">
          <select className="field" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option value="">Select</option>{["Immediately", "Within 2 weeks", "Within a month", "Just exploring"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Budget (optional)">
          <select className="field" value={budget} onChange={(e) => setBudget(e.target.value)}>
            <option value="">Select</option>{["Under $500/wk", "$500–$1,000/wk", "$1,000–$2,500/wk", "$2,500+/wk", "Prefer to discuss"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Anything we should know? (optional)"><textarea className="field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, preferences, schedule, languages spoken…" /></Field>
      <Consent checked={consent} onChange={setConsent} />
      {err && <p className="text-sm text-danger">{err}</p>}
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Submitting…" : "Reserve my place"}</button>
    </form>
  );
}

// ---- VIP Agency form ---------------------------------------------------
function AgencyForm() {
  const [agency, setAgency] = useState(""); const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); const [region, setRegion] = useState(""); const [years, setYears] = useState("");
  const [caregivers, setCaregivers] = useState(""); const [clients, setClients] = useState(""); const [offers, setOffers] = useState<string[]>([]);
  const [wants, setWants] = useState<string[]>([]); const [software, setSoftware] = useState(""); const [timeframe, setTimeframe] = useState("");
  const [consent, setConsent] = useState(false); const [err, setErr] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);

  if (done) return <ThankYou />;

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) { setErr("Please agree to the Privacy Notice to continue."); return; }
    setBusy(true);
    await submit("agency", { name, email, phone, region, timeframe },
      { agencyName: agency, yearsInOperation: years, caregivers, activeClients: clients, servicesOffered: offers.join(", "), needs: wants.join(", "), currentSoftware: software }, setErr, setDone);
    setBusy(false);
  }

  return (
    <form onSubmit={go} className="card space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agency name"><input className="field" value={agency} onChange={(e) => setAgency(e.target.value)} required /></Field>
        <Field label="Your name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Work email"><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Phone"><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="State / region"><input className="field" value={region} onChange={(e) => setRegion(e.target.value)} /></Field>
        <Field label="Years in operation">
          <select className="field" value={years} onChange={(e) => setYears(e.target.value)}>
            <option value="">Select</option>{["Launching", "1–2", "3–5", "6–10", "10+"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Caregivers">
          <select className="field" value={caregivers} onChange={(e) => setCaregivers(e.target.value)}>
            <option value="">Select</option>{["1–5", "6–20", "21–50", "50+"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Active clients">
          <select className="field" value={clients} onChange={(e) => setClients(e.target.value)}>
            <option value="">Select</option>{["1–10", "11–50", "51–200", "200+"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Services you offer">
        <Checks options={["Personal care", "Companion care", "Skilled nursing", "Dementia care", "Child care", "Pet care", "Home services", "Transportation"]} value={offers} onChange={setOffers} />
      </Field>
      <Field label="What you're looking for">
        <Checks options={["Scheduling", "Family bookings", "Payments", "Payroll", "E-sign documents", "Lead management", "White-label"]} value={wants} onChange={setWants} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Current software / tools (optional)"><input className="field" value={software} onChange={(e) => setSoftware(e.target.value)} placeholder="Spreadsheets, another platform…" /></Field>
        <Field label="Timeframe">
          <select className="field" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option value="">Select</option>{["Ready now", "This quarter", "This year", "Exploring"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <Consent checked={consent} onChange={setConsent} />
      {err && <p className="text-sm text-danger">{err}</p>}
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Submitting…" : "Request early access"}</button>
    </form>
  );
}
