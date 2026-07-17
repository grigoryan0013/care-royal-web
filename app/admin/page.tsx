"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifySession, apiGet, apiPost, signOutAndRedirect, setActingTenant, homeForRole, type Role } from "../lib/session";

interface Tenant { tenantId: string; name: string; plan: string; status: string; city: string; ownerEmail: string; ownerName: string; createdAt: string }
interface Person { userId: string; name: string; email: string; phone: string; role: string; status: string; tenantId: string; onboarding: Record<string, unknown>; createdAt: string }
type Cat = "agencies" | "managers" | "caregivers" | "families";

const OB_LABEL: Record<string, string> = { who: "Who needs care", services: "Services", location: "Location", start: "Timing", credentials: "Credentials", experience: "Experience" };

export default function AdminConsole() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [cat, setCat] = useState<Cat>("agencies");
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const r = await apiGet("/api/platform").catch(() => ({ tenants: [], people: [] }));
    setTenants(r.tenants || []); setPeople(r.people || []);
  }, []);

  useEffect(() => {
    (async () => {
      const u = await verifySession();
      if (!u || u.role !== "platform_owner") { router.replace("/login/"); return; }
      await load();
      setReady(true);
    })();
  }, [router, load]);

  function flash(t: string) { setMsg(t); setTimeout(() => setMsg(""), 3500); }
  function fmt(d: string) { return d ? new Date(d).toLocaleDateString() : ""; }
  const badge = (s: string) => (s === "pending" ? "badge-warn" : s === "active" || s === "trial" ? "badge-ok" : s === "suspended" ? "badge-gold" : "badge-muted");

  async function actTenant(t: Tenant, action: string, label: string) {
    setBusy(t.tenantId + action);
    try { await apiPost("/api/platform", { action, tenantId: t.tenantId, ownerEmail: t.ownerEmail, agencyName: t.name }); flash(`${t.name}: ${label}`); await load(); }
    catch (e) { flash((e as Error).message || "Something went wrong."); }
    setBusy("");
  }
  async function actPerson(p: Person, action: string, label: string) {
    setBusy(p.userId + action);
    try { await apiPost("/api/platform", { action, userId: p.userId }); flash(`${p.name || p.email}: ${label}`); await load(); }
    catch (e) { flash((e as Error).message || "Something went wrong."); }
    setBusy("");
  }

  function viewAs(t: Tenant, role: Role) { setActingTenant(t.tenantId, role, t.name); router.push(homeForRole(role)); }
  const VIEW_ROLES: [string, Role][] = [["Owner", "agency_admin"], ["Manager", "manager"], ["Staff", "caregiver"], ["Client", "family"]];

  function tenantCard(t: Tenant) {
    const b = busy.startsWith(t.tenantId);
    return (
      <div key={t.tenantId} className="border-b border-line py-4 last:border-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">{t.name}</span>
              <span className={`badge ${badge(t.status)}`}>{t.status}</span>
              <span className="badge badge-muted">{t.plan}</span>
            </div>
            <div className="mt-1 text-sm text-ink-light">{t.ownerName ? `${t.ownerName} · ` : ""}{t.ownerEmail || "no email"}{t.city ? ` · ${t.city}` : ""}{t.createdAt ? ` · joined ${fmt(t.createdAt)}` : ""}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            {t.status === "pending" && (<><button className="btn-primary" disabled={b} onClick={() => actTenant(t, "approve", "approved")}>Approve</button><button className="btn-ghost" disabled={b} onClick={() => actTenant(t, "reject", "rejected")}>Reject</button></>)}
            {(t.status === "active" || t.status === "trial") && <button className="btn-ghost" disabled={b} onClick={() => actTenant(t, "suspend", "paused")}>Pause</button>}
            {(t.status === "suspended" || t.status === "rejected") && <button className="btn-primary" disabled={b} onClick={() => actTenant(t, "reactivate", "reactivated")}>Reactivate</button>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-ink-light">View portal as</span>
          {VIEW_ROLES.map(([label, r]) => <button key={r} className="btn-ghost btn-sm" onClick={() => viewAs(t, r)}>{label}</button>)}
        </div>
      </div>
    );
  }

  function personCard(p: Person) {
    const b = busy.startsWith(p.userId);
    const entries = Object.entries(p.onboarding || {}).filter(([k, v]) => k !== "intent" && v && (Array.isArray(v) ? v.length : true));
    return (
      <div key={p.userId} className="border-b border-line py-4 last:border-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{p.name || "(no name)"}</span>
              <span className={`badge ${badge(p.status)}`}>{p.status}</span>
              <span className="badge badge-muted">{p.tenantId ? "agency member" : "direct lead"}</span>
            </div>
            <div className="mt-1 text-sm text-ink-light">{p.email}{p.phone ? ` · ${p.phone}` : ""}{p.createdAt ? ` · ${fmt(p.createdAt)}` : ""}</div>
            {entries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entries.map(([k, v]) => <span key={k} className="rounded bg-paper px-2 py-0.5 text-xs text-ink-mid"><b className="text-ink-light">{OB_LABEL[k] || k}:</b> {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</span>)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {p.status === "pending" && (<><button className="btn-primary" disabled={b} onClick={() => actPerson(p, "approve", "approved")}>Approve</button><button className="btn-ghost" disabled={b} onClick={() => actPerson(p, "reject", "rejected")}>Reject</button></>)}
            {p.status === "active" && <button className="btn-ghost" disabled={b} onClick={() => actPerson(p, "suspend", "paused")}>Pause</button>}
            {(p.status === "suspended" || p.status === "rejected") && <button className="btn-primary" disabled={b} onClick={() => actPerson(p, "reactivate", "reactivated")}>Reactivate</button>}
          </div>
        </div>
      </div>
    );
  }

  if (!ready) return <div className="app-bg flex min-h-screen items-center justify-center text-ink-light">Loading…</div>;

  const byRole = (r: string) => people.filter((p) => p.role === r);
  const counts: Record<Cat, number> = { agencies: tenants.length, managers: byRole("manager").length, caregivers: byRole("caregiver").length, families: byRole("family").length };
  const pendingTotal = tenants.filter((t) => t.status === "pending").length + people.filter((p) => p.status === "pending").length;
  const CATS: [Cat, string][] = [["agencies", "Agencies"], ["managers", "Managers"], ["caregivers", "Caregivers"], ["families", "Families"]];
  const rows = cat === "agencies" ? tenants.map(tenantCard) : byRole(cat === "managers" ? "manager" : cat === "caregivers" ? "caregiver" : "family").map(personCard);

  return (
    <div className="app-bg min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="font-serif text-2xl text-ink">The Care Royal — Platform</h1>
            <p className="text-sm text-ink-light">Review and approve everyone who signs up{pendingTotal ? ` · ${pendingTotal} awaiting review` : ""}.</p>
          </div>
          <button className="btn-ghost" onClick={() => signOutAndRedirect()}>Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {CATS.map(([k, label]) => (
            <button key={k} onClick={() => setCat(k)} className={cat === k ? "chip-on" : "chip-off"}>{label} <span className="opacity-70">({counts[k]})</span></button>
          ))}
        </div>

        {msg && <p className="mb-4 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}

        <div className="card">
          {rows.length > 0 ? rows : <p className="py-2 text-sm text-ink-light">No {cat} yet.</p>}
        </div>
      </main>
    </div>
  );
}
