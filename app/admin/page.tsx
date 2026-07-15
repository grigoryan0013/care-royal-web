"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifySession, apiGet, apiPost, signOutUser } from "../lib/session";

interface Tenant {
  tenantId: string; name: string; plan: string; status: string;
  city: string; ownerEmail: string; ownerName: string; createdAt: string;
}

export default function AdminConsole() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const r = await apiGet("/api/platform").catch(() => ({ tenants: [] }));
    setTenants(r.tenants || []);
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

  async function act(t: Tenant, action: string, label: string) {
    setBusy(t.tenantId + action);
    try {
      await apiPost("/api/platform", { action, tenantId: t.tenantId, ownerEmail: t.ownerEmail, agencyName: t.name });
      flash(`${t.name}: ${label}`);
      await load();
    } catch (e) { flash((e as Error).message || "Something went wrong."); }
    setBusy("");
  }

  function fmt(d: string) { return d ? new Date(d).toLocaleDateString() : ""; }

  const badge = (s: string) =>
    s === "pending" ? "badge-warn" : s === "active" || s === "trial" ? "badge-ok"
    : s === "suspended" ? "badge-gold" : "badge-muted";

  function card(t: Tenant) {
    const b = busy.startsWith(t.tenantId);
    return (
      <div key={t.tenantId} className="flex flex-col gap-3 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{t.name}</span>
            <span className={`badge ${badge(t.status)}`}>{t.status}</span>
            <span className="badge badge-muted">{t.plan}</span>
          </div>
          <div className="mt-1 text-sm text-ink-light">
            {t.ownerName ? `${t.ownerName} · ` : ""}{t.ownerEmail || "no email"}{t.city ? ` · ${t.city}` : ""}
            {t.createdAt ? ` · joined ${fmt(t.createdAt)}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {t.status === "pending" && (
            <>
              <button className="btn-primary" disabled={b} onClick={() => act(t, "approve", "approved")}>Approve</button>
              <button className="btn-ghost" disabled={b} onClick={() => act(t, "reject", "rejected")}>Reject</button>
            </>
          )}
          {(t.status === "active" || t.status === "trial") && (
            <button className="btn-ghost" disabled={b} onClick={() => act(t, "suspend", "paused")}>Pause</button>
          )}
          {(t.status === "suspended" || t.status === "rejected") && (
            <button className="btn-primary" disabled={b} onClick={() => act(t, "reactivate", "reactivated")}>Reactivate</button>
          )}
        </div>
      </div>
    );
  }

  if (!ready) return <div className="app-bg flex min-h-screen items-center justify-center text-ink-light">Loading…</div>;

  const pending = tenants.filter((t) => t.status === "pending");
  const activeList = tenants.filter((t) => t.status === "active" || t.status === "trial");
  const other = tenants.filter((t) => !["pending", "active", "trial"].includes(t.status));

  return (
    <div className="app-bg min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="font-serif text-2xl text-ink">Care Royal — Platform</h1>
            <p className="text-sm text-ink-light">Approve and manage agencies on the network.</p>
          </div>
          <button className="btn-ghost" onClick={() => { void signOutUser(); router.replace("/login/"); }}>Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Stat label="Awaiting review" value={pending.length} tone="text-warn" />
          <Stat label="Active agencies" value={activeList.length} tone="text-ok" />
          <Stat label="Total" value={tenants.length} tone="text-ink" />
        </div>

        {msg && <p className="mb-4 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{msg}</p>}

        <Section title={`Waitlist${pending.length ? ` (${pending.length})` : ""}`} empty="No agencies awaiting review.">
          {pending.map(card)}
        </Section>
        <Section title="Active" empty="No active agencies yet.">
          {activeList.map(card)}
        </Section>
        {other.length > 0 && (
          <Section title="Paused / rejected" empty="">
            {other.map(card)}
          </Section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card">
      <div className={`font-serif text-3xl ${tone}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-ink-light">{label}</div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.some(Boolean) && arr.flat().length > 0;
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-serif text-lg text-ink">{title}</h2>
      <div className="card">
        {has ? children : <p className="py-2 text-sm text-ink-light">{empty}</p>}
      </div>
    </section>
  );
}
