"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, homeForRole, verifySession } from "../lib/session";
import { isDemoBackend, enableDemo } from "../lib/demo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    verifySession().then((u) => { if (u) router.replace(homeForRole(u.role)); });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // Demo access — one login, all portals.
      if (email.trim().toLowerCase() === "grigoryan" && password === "201816") {
        enableDemo();
        router.replace("/demo/");
        return;
      }
      if (isDemoBackend()) {
        setErr("This is a preview. Sign in with the demo login to explore all portals.");
        return;
      }
      const user = await signIn(email, password);
      router.replace(homeForRole(user.role));
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-serif text-2xl font-semibold text-brand">
          Care Royal
        </Link>
        <div className="card">
          <h1 className="mb-1 font-serif text-2xl text-ink">Sign in</h1>
          <p className="mb-6 text-sm text-ink-light">Access for agencies, caregivers, and families.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email or username</label>
              <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "Please wait..." : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-ink-light">
          Not a member yet? <Link href="/" className="font-semibold text-brand">Join the waitlist</Link>.
        </p>
      </div>
    </main>
  );
}
