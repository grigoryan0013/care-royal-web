"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasDemoSession, setDemoRole, disableDemo } from "../lib/demo";
import { listOrgs, createOrg, setOrgStatus, mrr, PLAN_PRICE, type Org } from "../lib/orgs";
import { BarChart } from "../../components/Charts";

const PLANS = ["Starter", "Pro", "Enterprise"];

export default function OwnerConsole() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("Pro");
  const [flash, setFlash] = useState("");

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
  function openWorkspace() { setDemoRole("agency_admin"); router.push("/agency/"); }
  function toggle(o: Org) { setOrgStatus(o.id, o.status === "active" ? "suspended" : "active"); refresh(); }

  const active = orgs.filter((o) => o.status === "active").length;
  const monthly = mrr(orgs);
  const planBars = PLANS.map((p) => ({ label: p, value: orgs.filter((o) => o.status === "active" && o.plan === p).length, tone: p === "Enterprise" ? "purple" : p === "Pro" ? "brand" : "gold" }));
  const growthBars = (() => {
    const base = new Date(); const bars: { label: string; value: number; tone: string }[] = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1); bars.push({ label: d.toLocaleDateString(undefined, { month: "short" }), value: orgs.filter((o) => { const c = new Date(o.createdAt); return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth(); }).length, tone: "ok" }); }
    return bars;
  })();

  return (
    <main className="app-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-serif text-xl font-semibold text-white">C</span>
            <div>
              <h1 className="font-serif text-2xl text-ink">Care Royal — Owner</h1>
              <p className="text-sm text-ink-light">Provision agencies, track revenue, open any workspace.</p>
            </div>
          </div>
          <button onClick={() => { disableDemo(); router.replace("/"); }} className="text-xs font-semibold text-ink-light hover:text-danger">Exit</button>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card"><div className="font-serif text-3xl text-brand">{orgs.length}</div><div className="text-xs text-ink-light">Agencies</div></div>
          <div className="card"><div className="font-serif text-3xl text-ok">{active}</div><div className="text-xs text-ink-light">Active</div></div>
          <div className="card"><div className="font-serif text-3xl text-brand">${monthly.toLocaleString()}</div><div className="text-xs text-ink-light">MRR</div></div>
          <div className="card"><div className="font-serif text-3xl text-gold-dark">${(monthly * 12).toLocaleString()}</div><div className="text-xs text-ink-light">ARR (run-rate)</div></div>
        </div>

        <div className="card mb-6"><h3 className="mb-4 font-serif text-lg text-ink">New agencies per month</h3><BarChart data={growthBars} /></div>

        <div className="mb-6 grid gap-5 lg:grid-cols-2">
          <div className="card"><h3 className="mb-4 font-serif text-lg text-ink">Active agencies by plan</h3><BarChart data={planBars} /></div>
          <div className="card">
            <h3 className="font-serif text-lg text-ink">Provision an agency</h3>
            <p className="mt-1 text-sm text-ink-mid">Create a workspace and issue its admin login. Only you can do this.</p>
            <form onSubmit={provision} className="mt-4 space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agency name" className="field" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Admin email" className="field" />
              <div className="flex gap-2">
                <select value={plan} onChange={(e) => setPlan(e.target.value)} className="field">
                  {PLANS.map((p) => <option key={p} value={p}>{p} — ${PLAN_PRICE[p]}/mo</option>)}
                </select>
                <button type="submit" className="btn-primary whitespace-nowrap">Create</button>
              </div>
            </form>
            {flash && <p className="mt-3 rounded-lg bg-brand-light px-3 py-2 text-sm text-brand">{flash}</p>}
          </div>
        </div>

        <h2 className="mb-3 font-serif text-xl text-ink">Agencies</h2>
        <div className="overflow-x-auto rounded-xl2 border border-rule bg-white shadow-card">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-light">
              <tr><th className="px-4 py-3">Agency</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">MRR</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-t border-rule">
                  <td className="px-4 py-3 font-semibold text-ink">{o.name}</td>
                  <td className="px-4 py-3 text-ink-mid">{o.adminEmail}</td>
                  <td className="px-4 py-3 text-ink-mid">{o.plan}</td>
                  <td className="px-4 py-3 text-ink-mid">{o.status === "active" ? `$${(PLAN_PRICE[o.plan] || 0).toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3"><span className={o.status === "active" ? "badge-ok" : "badge-warn"}>{o.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <button onClick={openWorkspace} className="text-sm font-semibold text-brand hover:underline">Open</button>
                      <button onClick={() => toggle(o)} className="text-sm font-semibold text-ink-light hover:text-danger">{o.status === "active" ? "Suspend" : "Activate"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-ink-light"><Link href="/demo/" className="font-semibold text-brand">Back to portals</Link></p>
      </div>
    </main>
  );
}
