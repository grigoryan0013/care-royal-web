"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifySession, clearSession, homeForRole, type Role, type SessionUser } from "../app/lib/session";
import { hasDemoSession, setDemoRole, getDemoRole } from "../app/lib/demo";

export interface NavItem {
  key: string;
  label: string;
}

export default function PortalShell({
  title,
  allow,
  nav,
  active,
  onNav,
  children,
}: {
  title: string;
  allow: Role[];
  nav: NavItem[];
  active: string;
  onNav: (key: string) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    verifySession().then((u) => {
      if (!u) {
        router.replace("/login/");
        return;
      }
      if (!allow.includes(u.role)) {
        router.replace(homeForRole(u.role));
        return;
      }
      setUser(u);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-light">
        Loading...
      </div>
    );
  }

  function signOut() {
    if (hasDemoSession()) { router.replace("/demo/"); return; }
    clearSession();
    router.replace("/login/");
  }

  const demo = hasDemoSession();
  const demoRole = demo ? getDemoRole() : null;
  const switchTo = (r: Role) => { setDemoRole(r); router.push(r === "caregiver" ? "/caregiver/" : r === "family" ? "/family/" : "/agency/"); };

  return (
    <div>
      {demo && (
        <div className="flex flex-wrap items-center gap-2 bg-brand-dark px-4 py-2 text-xs text-white">
          <span className="font-semibold uppercase tracking-wide text-white/70">Demo — switch portal:</span>
          {([["agency_admin", "Agency"], ["family", "Family"], ["caregiver", "Caregiver"]] as [Role, string][]).map(([r, label]) => (
            <button key={r} onClick={() => switchTo(r)} className={`rounded px-2.5 py-1 font-semibold ${demoRole === r ? "bg-white text-brand-dark" : "bg-white/10 text-white hover:bg-white/20"}`}>{label}</button>
          ))}
          <button onClick={() => router.push("/demo/")} className="ml-auto rounded px-2.5 py-1 font-semibold text-white/70 hover:text-white">Demo home</button>
        </div>
      )}
      <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-rule bg-white md:flex">
        <div className="border-b border-rule px-6 py-5 font-serif text-xl font-semibold text-brand">
          Care Royal
        </div>
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-light">
          {title}
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => onNav(n.key)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                active === n.key ? "bg-brand-light text-brand" : "text-ink-mid hover:bg-paper"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-rule px-4 py-4">
          <div className="mb-2 truncate text-sm font-medium text-ink">{user.name || user.email}</div>
          <button onClick={signOut} className="text-xs font-semibold text-ink-light hover:text-danger">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-paper">
        <div className="border-b border-rule bg-white px-6 py-4 md:hidden">
          <div className="flex items-center justify-between">
            <span className="font-serif text-lg font-semibold text-brand">Care Royal</span>
            <button onClick={signOut} className="text-xs font-semibold text-ink-light">Sign out</button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
      </div>
    </div>
  );
}
