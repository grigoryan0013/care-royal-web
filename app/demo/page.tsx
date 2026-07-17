"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasDemoSession, setDemoRole, resetDemo, disableDemo } from "../lib/demo";
import type { Role } from "../lib/session";

const portals: { role: Role; title: string; desc: string }[] = [
  { role: "agency_admin", title: "Agency console", desc: "Approvals, clients, staff, the service catalog, schedule, payments, payroll, documents, and the lead pipeline." },
  { role: "family", title: "Family portal", desc: "Build a household, add people and pets, request care, pay invoices, and sign documents." },
  { role: "caregiver", title: "Caregiver app", desc: "See your schedule, clock in and out, claim open shifts, view pay, and sign documents." },
];

export default function DemoHub() {
  const router = useRouter();
  useEffect(() => { if (!hasDemoSession()) router.replace("/login/"); }, [router]);

  function enter(role: Role) {
    setDemoRole(role);
    router.push(role === "caregiver" ? "/caregiver/" : role === "family" ? "/family/" : "/agency/");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-brand">The Care Royal — demo</h1>
          <p className="mt-1 text-sm text-ink-light">Sample data loaded. Explore every portal, then switch anytime from the bar at the top.</p>
        </div>
        <button onClick={() => { disableDemo(); router.replace("/"); }} className="text-xs font-semibold text-ink-light hover:text-danger">Exit demo</button>
      </div>

      <Link href="/owner/" className="card mb-5 block border-brand/40 bg-brand/5 transition hover:border-brand">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-ink">Platform owner</h2>
          <span className="text-sm font-semibold text-brand">Open console →</span>
        </div>
        <p className="mt-2 text-sm text-ink-mid">You. Provision organizations (each agency that rents The Care Royal), issue their admin login, and open any workspace.</p>
      </Link>

      <div className="grid gap-5">
        {portals.map((p) => (
          <button key={p.role} onClick={() => enter(p.role)} className="card text-left transition hover:border-brand">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">{p.title}</h2>
              <span className="text-sm font-semibold text-brand">Enter →</span>
            </div>
            <p className="mt-2 text-sm text-ink-mid">{p.desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between rounded-xl2 border border-rule bg-white p-5">
        <div className="text-sm text-ink-mid">Made changes? Reset the sample data back to the start.</div>
        <button onClick={() => { resetDemo(); alert("Demo data reset."); }} className="btn-ghost">Reset demo data</button>
      </div>

      <p className="mt-6 text-center text-xs text-ink-light">
        <Link href="/" className="font-semibold text-brand">Back to the landing page</Link>
      </p>
    </main>
  );
}
