"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// One-time owner setup: creates the first admin account + agency (tenant).
// Not linked publicly. Run once, then sign in normally.
export default function Setup() {
  const router = useRouter();
  const [agency, setAgency] = useState("The Care Royal");
  const [name, setName] = useState("Owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      // Owner-only gate: provisioning agencies is restricted to the platform owner.
      if (code.trim() !== "201816") { setErr("Enter the owner passcode to provision an agency."); setBusy(false); return; }
      const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
      const uid = cred.user.uid;
      const now = new Date().toISOString();
      const tenantRef = doc(collection(db(), "tenants"));
      const tenantId = tenantRef.id;
      await setDoc(tenantRef, { tenantId, name: agency, slug: "care-royal", status: "active", createdAt: now });
      await setDoc(doc(db(), "users", uid), {
        userId: uid, tenantId, role: "agency_admin", name, email: email.trim(), phone: "", status: "active", createdAt: now,
      });
      router.replace("/agency/");
    } catch (e2: unknown) {
      setErr(e2 instanceof Error ? e2.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center font-serif text-2xl font-semibold text-brand">The Care Royal</Link>
        <div className="card">
          <h1 className="mb-1 font-serif text-2xl text-ink">Provision an agency</h1>
          <p className="mb-6 text-sm text-ink-light">Owner only. Create an agency workspace and issue its admin login.</p>
          <form onSubmit={submit} className="space-y-4">
            <div><label className="label">Owner passcode</label><input className="field" type="password" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" required /></div>
            <div><label className="label">Agency name</label><input className="field" value={agency} onChange={(e) => setAgency(e.target.value)} required /></div>
            <div><label className="label">Your name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><label className="label">Admin email</label><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" required /></div>
            <div><label className="label">Password</label><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
            {err && <p className="rounded-lg border-l-4 border-gold bg-gold/10 px-3.5 py-2.5 text-sm text-ink-mid">{err}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Setting up…" : "Create admin & agency"}</button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-ink-light">Already set up? <Link href="/login/" className="font-semibold text-brand">Sign in</Link></p>
      </div>
    </main>
  );
}
