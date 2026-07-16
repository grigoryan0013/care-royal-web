"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifySession, signOutAndRedirect, homeForRole, apiGet, getActingTenant, clearActingTenant, type Role, type SessionUser } from "../app/lib/session";
import Icon, { type IconName } from "./Icon";

interface Branding { displayName?: string; logoUrl?: string; brandColor?: string; accentColor?: string }

export interface NavItem {
  key: string;
  label: string;
  icon?: IconName;
}
export interface NotifItem { text: string; sub?: string; tone?: "brand" | "gold" | "ok" }

function NotificationBell({ items }: { items: NotifItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative text-ink-mid hover:text-ink" aria-label="Notifications">
        <Icon name="bell" />
        {items.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{items.length}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 animate-fade-in rounded-xl border border-rule bg-white p-2 shadow-pop">
            <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-light">Notifications</div>
            {items.length === 0 && <p className="px-2 py-3 text-sm text-ink-light">You&apos;re all caught up.</p>}
            {items.map((n, i) => (
              <div key={i} className="flex gap-2 rounded-lg px-2 py-2 hover:bg-paper">
                <span className={`mt-1 stat-dot ${n.tone === "gold" ? "bg-gold" : n.tone === "ok" ? "bg-ok" : "bg-brand"}`} />
                <div><div className="text-sm text-ink">{n.text}</div>{n.sub && <div className="text-xs text-ink-light">{n.sub}</div>}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PortalShell({
  title,
  allow,
  nav,
  active,
  onNav,
  notifications,
  children,
}: {
  title: string;
  allow: Role[];
  nav: NavItem[];
  active: string;
  onNav: (key: string) => void;
  notifications?: NotifItem[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [brand2, setBrand2] = useState<Branding>({});

  useEffect(() => {
    verifySession().then((u) => {
      if (!u) { router.replace("/login/"); return; }
      if (!allow.includes(u.role)) { router.replace(homeForRole(u.role)); return; }
      setUser(u);
      setReady(true);
      // White-label (item 6): apply the tenant's own name / logo / colors.
      apiGet("/api/branding").then((d) => {
        const b: Branding = d.branding || {};
        setBrand2(b);
        if (typeof document !== "undefined") {
          if (b.brandColor) document.documentElement.style.setProperty("--cr-brand", b.brandColor);
          if (b.accentColor) document.documentElement.style.setProperty("--cr-accent", b.accentColor);
        }
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready || !user) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-ink-light">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Loading your workspace…
        </div>
      </div>
    );
  }

  function signOut() {
    void signOutAndRedirect();
  }

  const initials = (user.name || user.email || "?").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const navList = (
    <nav className="flex-1 space-y-0.5 px-3">
      {nav.map((n) => (
        <button
          key={n.key}
          onClick={() => { onNav(n.key); setDrawer(false); }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
            active === n.key ? "bg-brand text-white shadow-sm" : "text-ink-mid hover:bg-brand-light hover:text-brand"
          }`}
        >
          <Icon name={n.icon || "dashboard"} size={18} className="shrink-0" />
          {n.label}
        </button>
      ))}
    </nav>
  );

  const brandName = brand2.displayName || "Care Royal";
  const brand = (
    <div className="flex items-center gap-2 px-6 py-5">
      {brand2.logoUrl
        ? <img src={brand2.logoUrl} alt={brandName} className="h-8 w-8 rounded-lg object-cover" />
        : <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-serif text-lg font-semibold text-white" style={brand2.brandColor ? { background: brand2.brandColor } : undefined}>{brandName.slice(0, 1).toUpperCase()}</span>}
      <span className="font-serif text-xl font-semibold text-brand" style={brand2.brandColor ? { color: brand2.brandColor } : undefined}>{brandName}</span>
    </div>
  );

  const acting = getActingTenant();
  const roleLabel: Record<string, string> = { agency_admin: "Owner", agency_coord: "Owner", manager: "Manager", caregiver: "Staff", family: "Client" };

  return (
    <div className="app-bg min-h-screen">
      {acting && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-2 text-sm text-white">
          <span>Viewing <b>{acting.agencyName || "agency"}</b> as {roleLabel[acting.role] || acting.role} — read-only oversight</span>
          <button
            className="rounded bg-white/20 px-3 py-1 font-semibold hover:bg-white/30"
            onClick={() => { clearActingTenant(); window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/`; }}
          >Exit to admin</button>
        </div>
      )}
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-rule bg-white md:flex">
          {brand}
          <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-light">{title}</div>
          {navList}
          <div className="m-3 flex items-center gap-3 rounded-xl border border-rule bg-paper px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{user.name || user.email}</div>
              <button onClick={signOut} className="text-xs font-semibold text-ink-light hover:text-danger">Sign out</button>
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
            <aside className="absolute left-0 top-0 flex h-full w-72 animate-slide-in flex-col bg-white shadow-pop">
              <div className="flex items-center justify-between pr-3">
                {brand}
                <button onClick={() => setDrawer(false)} className="text-ink-light"><Icon name="close" /></button>
              </div>
              <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-light">{title}</div>
              {navList}
              <button onClick={signOut} className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-light hover:text-danger"><Icon name="logout" size={18} />Sign out</button>
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          {/* Topbar (bell always; menu + brand on mobile) */}
          <div className="flex items-center gap-3 border-b border-rule bg-white px-4 py-3 md:px-8">
            <button onClick={() => setDrawer(true)} className="text-ink-mid md:hidden"><Icon name="menu" /></button>
            <span className="font-serif text-lg font-semibold text-brand md:hidden" style={brand2.brandColor ? { color: brand2.brandColor } : undefined}>{brandName}</span>
            <div className="ml-auto flex items-center gap-3">
              <NotificationBell items={notifications || []} />
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-semibold text-white md:hidden">{initials}</span>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
