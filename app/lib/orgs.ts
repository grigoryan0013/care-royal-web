// Platform-owner layer: the organizations (tenants) the owner provisions.
// Demo-mode store (localStorage) so the owner console is fully explorable in the
// live demo. Real mode wires the same shape to Firestore `Tenants` + a Users row
// (role agency_admin) — see fb.ts /api/owner (to be added for go-live).

export interface Org {
  id: string;
  name: string;
  adminEmail: string;
  plan: string;
  status: "active" | "suspended";
  createdAt: string;
}

const KEY = "cr_demo_orgs";

// Monthly price per plan — drives the owner console MRR/ARR metrics.
export const PLAN_PRICE: Record<string, number> = { Starter: 149, Pro: 399, Enterprise: 999 };
export function mrr(orgs: Org[]): number {
  return orgs.filter((o) => o.status === "active").reduce((t, o) => t + (PLAN_PRICE[o.plan] || 0), 0);
}

function seed(): Org[] {
  const d = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
  return [
    { id: "t_demo", name: "The Care Royal", adminEmail: "grigoryan", plan: "Pro", status: "active", createdAt: d(120) },
    { id: "t_sun", name: "Sunrise Home Care", adminEmail: "admin@sunrisehc.com", plan: "Enterprise", status: "active", createdAt: d(86) },
    { id: "t_gld", name: "Golden Years Caregivers", adminEmail: "ops@goldenyears.com", plan: "Pro", status: "active", createdAt: d(54) },
    { id: "t_com", name: "Comfort Keepers LA", adminEmail: "hello@comfortla.com", plan: "Starter", status: "active", createdAt: d(31) },
    { id: "t_hrt", name: "Heartland Family Care", adminEmail: "team@heartland.com", plan: "Starter", status: "suspended", createdAt: d(12) },
  ];
}

export function listOrgs(): Org[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
  try { return JSON.parse(raw) as Org[]; } catch { return seed(); }
}

export function createOrg(name: string, adminEmail: string, plan: string): Org {
  const orgs = listOrgs();
  const org: Org = {
    id: "t_" + Math.random().toString(36).slice(2, 8),
    name: name.trim(),
    adminEmail: adminEmail.trim(),
    plan,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  orgs.unshift(org);
  localStorage.setItem(KEY, JSON.stringify(orgs));
  return org;
}

export function setOrgStatus(id: string, status: Org["status"]) {
  const orgs = listOrgs().map((o) => (o.id === id ? { ...o, status } : o));
  localStorage.setItem(KEY, JSON.stringify(orgs));
}
