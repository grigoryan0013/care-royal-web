"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp, homeForRole, verifySession, apiGet, authErrorMessage, resetPassword, isAccountExistsError, lookupAccountType, type SignupRole } from "../lib/session";

type Tab = "signin" | "signup";
const ROLES: { key: SignupRole; label: string; blurb: string }[] = [
  { key: "agency", label: "Care agency", blurb: "Run scheduling, staff, billing & payroll" },
  { key: "manager", label: "Manager", blurb: "Run day-to-day for an agency (owner approves)" },
  { key: "family", label: "Family", blurb: "Book & manage care for a loved one" },
  { key: "caregiver", label: "Caregiver", blurb: "See your shifts, clock in, get paid" },
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
  const [showReset, setShowReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

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
        router.replace(homeForRole(u.role));
      } else {
        if (password.length < 6) { setErr("Please choose a password with at least 6 characters."); return; }
        const u = await signUp({ role, name, email, password, agencyName, joinCode });
        router.replace(homeForRole(u.role));
      }
    } catch (e2: unknown) {
      if (isAccountExistsError(e2)) {
        const t = await lookupAccountType(email);
        setErr(t ? `That email already has a ${t} account. Please sign in or reset your password.` : authErrorMessage(e2));
      } else {
        setErr(authErrorMessage(e2));
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setResetMsg(""); setResetBusy(true);
    try {
      await resetPassword(email);
      setResetMsg(`If an account exists for ${email.includes("@") ? email : "that login"}, we've emailed a password-reset link. Check your inbox (and spam).`);
    } catch (e2: unknown) {
      // Don't reveal whether the account exists — show the same reassuring note.
      setResetMsg(`If an account exists for ${email.includes("@") ? email : "that login"}, we've emailed a password-reset link. Check your inbox (and spam).`);
    } finally {
      setResetBusy(false);
    }
  }

  const needsCode = tab === "signup" && role !== "agency";

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-serif text-2xl font-semibold text-ink">The Care Royal</Link>

          <div className="mb-6 mx-auto flex w-fit rounded-xl border border-rule bg-white p-1 shadow-card">
            <button onClick={() => { setTab("signin"); setErr(""); }} className={tab === "signin" ? "chip-on" : "chip-off !bg-transparent !text-ink-mid"}>Sign in</button>
            <button onClick={() => router.push("/get-started/")} className="chip-off !bg-transparent !text-ink-mid">Create account</button>
          </div>

          <div className="card">
            {agencyBrand && (
              <div className="mb-4 rounded-lg border border-brand/30 bg-brand-light px-3 py-2 text-sm text-brand">
                Joining <span className="font-semibold">{agencyBrand}</span> on The Care Royal
              </div>
            )}
            {showReset ? (
              <>
                <h1 className="font-serif text-2xl text-ink">Reset your password</h1>
                <p className="mb-6 mt-1 text-sm text-ink-light">Enter your email or username and we&apos;ll email you a secure link to set a new password.</p>
                <form onSubmit={sendReset} className="space-y-4">
                  <div>
                    <label className="label">Email or username</label>
                    <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" placeholder="you@agency.com" required />
                  </div>
                  {resetMsg && <p className="rounded-lg border-l-4 border-brand bg-brand-light px-3.5 py-2.5 text-sm text-ink">{resetMsg}</p>}
                  <button className="btn-primary btn-lg w-full" disabled={resetBusy}>{resetBusy ? "Sending…" : "Email me a reset link"}</button>
                  <button type="button" onClick={() => { setShowReset(false); setResetMsg(""); setErr(""); }} className="block w-full text-center text-sm font-semibold text-brand">Back to sign in</button>
                </form>
              </>
            ) : (
            <>
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
                <div className="flex items-baseline justify-between">
                  <label className="label">Password</label>
                  {tab === "signin" && <button type="button" onClick={() => { setShowReset(true); setErr(""); setResetMsg(""); }} className="text-xs font-semibold text-brand">Forgot password?</button>}
                </div>
                <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tab === "signup" ? "At least 6 characters" : "••••••••"} required />
              </div>

              {err && (
                <div className="rounded-lg border-l-4 border-gold bg-gold/10 px-3.5 py-2.5 text-sm text-ink-mid">
                  {err}
                  {/\breset your password\b/i.test(err) && (
                    <button type="button" onClick={() => { setShowReset(true); setErr(""); setResetMsg(""); }} className="ml-1 font-semibold text-brand">Reset it now</button>
                  )}
                </div>
              )}
              <button className="btn-primary btn-lg w-full" disabled={busy}>
                {busy ? "Please wait…" : tab === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
            </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-ink-light">
            {tab === "signin" ? (
              <>New to The Care Royal? <button onClick={() => setTab("signup")} className="font-semibold text-brand">Create an account</button></>
            ) : (
              <>Already have an account? <button onClick={() => setTab("signin")} className="font-semibold text-brand">Sign in</button></>
            )}
          </p>
      </div>
    </main>
  );
}
