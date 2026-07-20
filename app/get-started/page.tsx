"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp, homeForRole, authErrorMessage, isAccountExistsError } from "../lib/session";
import Icon, { type IconName } from "../../components/Icon";

type Intent = "care" | "work" | "code";

const INTENTS: { key: Intent; label: string; blurb: string; icon: IconName }[] = [
  { key: "care", label: "I'm looking for care", blurb: "Find trusted care for someone you love", icon: "clients" },
  { key: "work", label: "I'm looking for care work", blurb: "Find caregiving work that fits your life", icon: "staff" },
  { key: "code", label: "I have a sign-up code", blurb: "Join an agency you already work with", icon: "building" },
];

const WHO = ["A parent or senior", "A child", "Myself", "A pet", "My home"];
const CARE_SERVICES = ["Personal care", "Companionship", "Meal prep", "Housekeeping", "Transportation", "Skilled nursing", "Dementia care", "Child care", "Pet care", "Respite"];
const WORK_SERVICES = ["Personal care / CNA", "Companion care", "Skilled nursing (LVN/RN)", "Housekeeping", "Child care", "Pet care", "Driving / transport"];
const START = ["As soon as possible", "Within a few weeks", "Just exploring"];

export default function GetStarted() {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent | "">("");
  const [step, setStep] = useState(0); // 0 intent · 1 questions · 2 account
  const [ans, setAns] = useState<Record<string, unknown>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [agencyRole, setAgencyRole] = useState<"manager" | "caregiver">("manager");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [exists, setExists] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = (new URLSearchParams(window.location.search).get("code") || "").trim().toUpperCase();
    if (c) { setIntent("code"); setCode(c); setStep(1); }
  }, []);

  const set = (k: string, v: unknown) => setAns((a) => ({ ...a, [k]: v }));
  const arr = (k: string): string[] => (ans[k] as string[]) || [];
  const toggle = (k: string, v: string) => setAns((a) => { const cur = (a[k] as string[]) || []; return { ...a, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }; });

  function pickIntent(i: Intent) { setIntent(i); setAns({}); setStep(1); }

  function step1Valid(): boolean {
    if (intent === "code") return code.trim().length >= 4;
    if (intent === "care") return !!ans.who;
    if (intent === "work") return arr("services").length > 0;
    return false;
  }

  async function submit() {
    setErr(""); setExists(false);
    if (password.length < 6) { setErr("Please choose a password with at least 6 characters."); return; }
    setBusy(true);
    try {
      const role = intent === "care" ? "family" : intent === "work" ? "caregiver" : agencyRole;
      const u = await signUp({
        role, name, email, password, phone,
        joinCode: intent === "code" ? code : undefined,
        onboarding: { intent, ...ans },
      });
      router.replace(homeForRole(u.role));
    } catch (e) {
      setErr(authErrorMessage(e));
      setExists(isAccountExistsError(e));
      setBusy(false);
    }
  }

  const totalSteps = 3;

  return (
    <main className="app-bg min-h-screen">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/login/" className="font-serif text-xl font-semibold text-ink">The Care Royal</Link>
          <Link href="/login/" className="text-sm text-ink-light hover:text-ink">Already have an account? Sign in</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-10">
        {/* progress */}
        <div className="mb-8 flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-rule"}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h1 className="font-serif text-3xl text-ink">Welcome to The Care Royal</h1>
            <p className="mt-2 text-ink-light">Let&apos;s get you to the right place. What brings you here?</p>
            <div className="mt-6 grid gap-3">
              {INTENTS.map((it) => (
                <button key={it.key} onClick={() => pickIntent(it.key)}
                  className="flex items-center gap-4 rounded-xl border border-rule-dark bg-white p-4 text-left transition hover:border-brand hover:bg-brand-light">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-light text-brand"><Icon name={it.icon} /></span>
                  <span>
                    <span className="block font-semibold text-ink">{it.label}</span>
                    <span className="block text-sm text-ink-light">{it.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && intent === "care" && (
          <StepCard title="Tell us who needs care" sub="A couple quick questions so we can help.">
            <Field label="Who needs care?">
              <div className="flex flex-wrap gap-2">{WHO.map((w) => <Chip key={w} on={ans.who === w} onClick={() => set("who", w)}>{w}</Chip>)}</div>
            </Field>
            <Field label="What kind of help? (optional)">
              <div className="flex flex-wrap gap-2">{CARE_SERVICES.map((s) => <Chip key={s} on={arr("services").includes(s)} onClick={() => toggle("services", s)}>{s}</Chip>)}</div>
            </Field>
            <Field label="City or ZIP (optional)"><input className="field" value={(ans.location as string) || ""} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Los Angeles, 90026" /></Field>
            <Field label="When would you like to start? (optional)">
              <div className="flex flex-wrap gap-2">{START.map((s) => <Chip key={s} on={ans.start === s} onClick={() => set("start", s)}>{s}</Chip>)}</div>
            </Field>
          </StepCard>
        )}

        {step === 1 && intent === "work" && (
          <StepCard title="Tell us about your care work" sub="This helps agencies match you to the right roles.">
            <Field label="What care work do you do?">
              <div className="flex flex-wrap gap-2">{WORK_SERVICES.map((s) => <Chip key={s} on={arr("services").includes(s)} onClick={() => toggle("services", s)}>{s}</Chip>)}</div>
            </Field>
            <Field label="Credentials (optional)"><input className="field" value={(ans.credentials as string) || ""} onChange={(e) => set("credentials", e.target.value)} placeholder="e.g. CNA, CPR, HHA" /></Field>
            <Field label="Years of experience (optional)"><input className="field" value={(ans.experience as string) || ""} onChange={(e) => set("experience", e.target.value)} placeholder="e.g. 3 years" /></Field>
            <Field label="City or ZIP you can work in (optional)"><input className="field" value={(ans.location as string) || ""} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Los Angeles, 90026" /></Field>
          </StepCard>
        )}

        {step === 1 && intent === "code" && (
          <StepCard title="Join your agency" sub="Enter the sign-up code your agency gave you.">
            <Field label="Agency sign-up code"><input className="field uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7KQ9PX" /></Field>
            <Field label="What's your role at the agency?">
              <div className="flex flex-wrap gap-2">
                <Chip on={agencyRole === "manager"} onClick={() => setAgencyRole("manager")}>Manager</Chip>
                <Chip on={agencyRole === "caregiver"} onClick={() => setAgencyRole("caregiver")}>Caregiver / staff</Chip>
              </div>
            </Field>
          </StepCard>
        )}

        {step === 2 && (
          <StepCard title="Create your account" sub="Last step — then we'll get you set up.">
            <Field label="Full name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" /></Field>
            <Field label="Email"><input className="field" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
            <Field label="Phone (optional)"><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" /></Field>
            <Field label="Password"><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></Field>
            {err && (
              <div className="rounded-lg border-l-4 border-gold bg-gold/10 px-3.5 py-2.5 text-sm text-ink-mid">
                {err}
                {exists && <> <Link href="/login/" className="font-semibold text-brand">Sign in or reset your password</Link></>}
              </div>
            )}
          </StepCard>
        )}

        {/* nav */}
        {step > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => (step === 1 ? (setStep(0), setIntent("")) : setStep(step - 1))} className="btn-ghost">Back</button>
            {step === 1 && <button onClick={() => step1Valid() && setStep(2)} disabled={!step1Valid()} className="btn-primary">Next</button>}
            {step === 2 && <button onClick={submit} disabled={busy || !name.trim() || !email.trim()} className="btn-primary">{busy ? "Creating account…" : "Create account"}</button>}
          </div>
        )}
      </div>
    </main>
  );
}

function StepCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-serif text-3xl text-ink">{title}</h1>
      <p className="mt-2 text-ink-light">{sub}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={on ? "chip-on" : "chip-off"}>{children}</button>;
}
