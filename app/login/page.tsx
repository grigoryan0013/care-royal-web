"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp, homeForRole, verifySession, apiGet, type SignupRole } from "../lib/session";
import { hasDemoSession } from "../lib/demo";
import Icon from "../../components/Icon";

type Tab = "signin" | "signup";
const ROLES: { key: SignupRole; label: string; blurb: string }[] = [
  { key: "agency", label: "Care agency", blurb: "Run scheduling, staff, billing & payroll" },
  { key: "manager", label: "Manager", blurb: "Run day-to-day for an agency (owner approves)" },
  { key: "family", label: "Family", blurb: "Book & manage care for a loved one" },
  { key: "caregiver", label: "Caregiver", blurb: "See your shifts, clock in, get paid" },
];

const HIGHLIGHTS = [
  "Warm, dependable care for the people you love",
  "Caregivers matched to your family with care",
  "One calm place to plan visits and stay close",
  "Meaningful caregiving work, on a schedule that fits your life",
];

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [role, setRole] = useState<SignupRole>("agency");
  const [name, setName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [agencyBrand, setAgencyBrand] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    // Creating an account (or arriving via a per-agency ?a=CODE link) goes to the
    // guided get-started wizard — no role picker here.
    if (params.get("mode") === "signup") { router.replace("/get-started/"); return; }
    const code = (params.get("a") || "").trim().toUpperCase();
    if (code) { router.replace(`/get-started/?code=${code}`); return; }
    verifySession().then((u) => { if (u) router.replace(homeForRole(u.role)); });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (tab === "signin") {
        const u = await signIn(email, password);
        // Demo login lands on the hub (all portals + platform-owner console).
        router.replace(hasDemoSession() ? "/demo/" : homeForRole(u.role));
      } else {
        if (password.length < 6) { setErr("Choose a password with at least 6 characters."); return; }
        const u = await signUp({ role, name, email, password, agencyName, joinCode });
        router.replace(homeForRole(u.role));
      }
    } catch (e2: unknown) {
      const m = e2 instanceof Error ? e2.message : "Something went wrong";
      setErr(m.replace("Firebase:", "").replace(/\(auth\/.*\)\.?/, "").trim() || m);
    } finally {
      setBusy(false);
    }
  }

  const needsCode = tab === "signup" && role !== "agency";

  return (
    <main className="flex min-h-screen">
      {/* Brand panel — warm, welcoming (no blue) with a soft illustrated backdrop */}
      <aside
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: "linear-gradient(155deg,#5c3b34 0%,#a85f4c 48%,#d9a066 100%)" }}
      >
        {/* soft decorative shapes */}
        <svg aria-hidden viewBox="0 0 600 800" className="pointer-events-none absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="xMidYMid slice">
          <circle cx="480" cy="120" r="160" fill="#ffffff" opacity="0.10" />
          <circle cx="120" cy="640" r="220" fill="#ffffff" opacity="0.08" />
          <path d="M300 430c-26-24-70-20-86 10-16-30-60-34-86-10-30 28-14 78 86 150 100-72 116-122 86-150z" fill="#ffffff" opacity="0.18" />
        </svg>
        <Link href="/" className="relative font-serif text-2xl font-semibold tracking-wide">The Care Royal</Link>
        <div className="relative max-w-md">
          <h2 className="font-serif text-4xl leading-tight">Care you can trust, for the people you love.</h2>
          <p className="mt-4 text-white/85">Compassionate care and dependable caregivers — brought together with warmth and a personal touch.</p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-start gap-3 text-white/90">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25"><Icon name="check" size={12} /></span>
                <span className="text-sm">{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">Families and caregivers, cared for in one welcoming place.</p>
      </aside>

      {/* Form panel */}
      <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 block font-serif text-2xl font-semibold text-ink lg:hidden">The Care Royal</Link>

          <div className="mb-6 inline-flex rounded-xl border border-rule bg-white p-1 shadow-card">
            <button onClick={() => { setTab("signin"); setErr(""); }} className={tab === "signin" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>Sign in</button>
            <button onClick={() => router.push("/get-started/")} className="chip-off !bg-transparent !text-ink-mid">Create account</button>
          </div>

          <div className="card">
            {agencyBrand && (
              <div className="mb-4 rounded-lg border border-brand/30 bg-brand-light px-3 py-2 text-sm text-brand">
                Joining <span className="font-semibold">{agencyBrand}</span> on The Care Royal
              </div>
            )}
            <h1 className="font-serif text-2xl text-ink">{tab === "signin" ? "Welcome back" : "Get started"}</h1>
            <p className="mb-6 mt-1 text-sm text-ink-light">
              {tab === "signin" ? "Sign in to your Care Royal workspace." : "Create your account in under a minute."}
            </p>

            <form onSubmit={submit} className="space-y-4">
              {tab === "signup" && (
                <div>
                  <label className="label">I&apos;m signing up as</label>
                  <div className="grid gap-2">
                    {ROLES.map((r) => (
                      <button type="button" key={r.key} onClick={() => setRole(r.key)}
                        className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition ${role === r.key ? "border-brand bg-brand-light" : "border-rule-dark bg-white hover:border-brand/50"}`}>
                        <span>
                          <span className="block text-sm font-semibold text-ink">{r.label}</span>
                          <span className="block text-xs text-ink-light">{r.blurb}</span>
                        </span>
                        <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${role === r.key ? "border-brand bg-brand" : "border-rule-dark"}`}>
                          {role === r.key && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === "signup" && (
                <div>
                  <label className="label">Your name</label>
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
                </div>
              )}
              {tab === "signup" && role === "agency" && (
                <div>
                  <label className="label">Agency name</label>
                  <input className="field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Sunrise Home Care" required />
                </div>
              )}
              {needsCode && (
                <div>
                  <label className="label">Agency code</label>
                  <input className="field uppercase tracking-widest" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="e.g. 7KQ9PX" required />
                  <p className="hint">Ask your care agency for their 6-character The Care Royal code.</p>
                </div>
              )}

              <div>
                <label className="label">{tab === "signin" ? "Email or username" : "Email"}</label>
                <input className="field" type={tab === "signup" ? "email" : "text"} value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" placeholder="you@agency.com" required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tab === "signup" ? "At least 6 characters" : "••••••••"} required />
              </div>

              {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
              <button className="btn-primary btn-lg w-full" disabled={busy}>
                {busy ? "Please wait…" : tab === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-ink-light">
            {tab === "signin" ? (
              <>New to The Care Royal? <button onClick={() => setTab("signup")} className="font-semibold text-brand">Create an account</button></>
            ) : (
              <>Already have an account? <button onClick={() => setTab("signin")} className="font-semibold text-brand">Sign in</button></>
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
