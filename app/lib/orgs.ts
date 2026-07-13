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

function seed(): Org[] {
  return [
    { id: "t_demo", name: "Care Royal", adminEmail: "grigoryan", plan: "Pro", status: "active", createdAt: new Date().toISOString() },
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
