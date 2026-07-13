"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasDemoSession, setDemoRole, disableDemo } from "../lib/demo";
import { listOrgs, createOrg, setOrgStatus, type Org } from "../lib/orgs";

const PLANS = ["Starter", "Pro", "Enterprise"];

export default function OwnerConsole() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("Pro");
  const [flash, setFlash] = useState<string>("");

  useEffect(() => {
    if (!hasDemoSession()) { router.replace("/login/"); return; }
    setOrgs(listOrgs());
  }, [router]);

  function refresh() { setOrgs(listOrgs()); }

  function provision(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const org = createOrg(name, email, plan);
    setName(""); setEmail(""); setPlan("Pro");
    setFlash(`Workspace "${org.name}" created. Admin login issued to ${org.adminEmail}.`);
    refresh();
  }

  function openWorkspace() {
    setDemoRole("agency_admin");
    router.push("/agency/");
  }

  function toggle(o: Org) {
    setOrgStatus(o.id, o.status === "active" ? "suspended" : "active");
    refresh();
  }

  const active = orgs.filter((o) => o.status === "active").length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-brand">Care Royal — Owner</h1>
          <p className="mt-1 text-sm text-ink-light">The platform. Provision organizations, issue their admin login, and open any workspace.</p>
        </div>
        <button onClick={() => { disableDemo(); router.replace("/"); }} className="text-xs font-semibold text-ink-light hover:text-danger">Exit</button>
      </div>

      {/* summary */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card"><div className="font-serif text-3xl text-brand">{orgs.length}</div><div className="text-xs text-ink-light">Organizations</div></div>
        <div className="card"><div className="font-serif text-3xl text-brand">{active}</div><div className="text-xs text-ink-light">Active</div></div>
        <div className="card"><div className="font-serif text-3xl text-brand">{orgs.length - active}</div><div className="text-xs text-ink-light">Suspended</div></div>
      </div>

      {/* provision a new organization */}
      <div className="card mb-8">
        <h2 className="font-serif text-xl text-ink">Provision an organization</h2>
        <p className="mt-1 text-sm text-ink-mid">Create a workspace for a business and issue its admin login. Only you can do this.</p>
        <form onSubmit={provision} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name" className="rounded-xl2 border border-rule px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" className="rounded-xl2 border border-rule px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-xl2 border border-rule px-3 py-2 text-sm">
              {PLANS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <button type="submit" className="whitespace-nowrap rounded-xl2 bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Create</button>
          </div>
        </form>
        {flash && <p className="mt-3 rounded-xl2 border border-brand/25 bg-brand/5 px-3 py-2 text-sm text-ink-mid">{flash}</p>}
      </div>

      {/* organizations list */}
      <h2 className="mb-3 font-serif text-xl text-ink">Organizations</h2>
      <div className="overflow-x-auto rounded-xl2 border border-rule">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-brand-light text-xs uppercase tracking-wide text-ink-mid">
            <tr><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-rule">
                <td className="px-4 py-3 font-semibold text-ink">{o.name}</td>
                <td className="px-4 py-3 text-ink-mid">{o.adminEmail}</td>
                <td className="px-4 py-3 text-ink-mid">{o.plan}</td>
                <td className="px-4 py-3">
                  <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (o.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{o.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3">
                    <button onClick={openWorkspace} className="text-sm font-semibold text-brand hover:underline">Open workspace →</button>
                    <button onClick={() => toggle(o)} className="text-sm font-semibold text-ink-light hover:text-danger">{o.status === "active" ? "Suspend" : "Activate"}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-xs text-ink-light">
        <Link href="/demo/" className="font-semibold text-brand">Back to portals</Link>
      </p>
    </main>
  );
}
