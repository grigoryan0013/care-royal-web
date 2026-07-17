// Session + API helpers. Real mode = Firebase Auth + Firestore (client-side).
// Demo mode (grigoryan/201816) = in-browser mock, still available for testing.
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged,
} from "firebase/auth";
import { collection, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import { fbHandle, clearProfileCache } from "./fb";
import { DEFAULT_SERVICES } from "./catalog";
import { isDemoBackend, hasDemoSession, getDemoRole, demoUser, demoHandle, disableDemo, enableDemo } from "./demo";

// Documented owner/testing login — enters the in-browser demo (no Firebase).
export const DEMO_USERNAME = "grigoryan";
export const DEMO_PASSWORD = "201816";

export type Role = "platform_owner" | "agency_admin" | "agency_coord" | "manager" | "caregiver" | "family";
// The Care Royal platform super-admins (recognized by login email — no tenant).
export const SUPERADMIN_EMAILS = ["info@thecareroyal.com"];
export type SignupRole = "agency" | "family" | "caregiver" | "manager";

// What a manager is allowed to do inside their agency. The Owner toggles these.
export type Permissions = Record<string, boolean>;
export const MANAGER_PERMISSION_KEYS = ["clients", "schedule", "messages", "documents", "leads", "staff", "money"] as const;
export const DEFAULT_MANAGER_PERMISSIONS: Permissions = {
  clients: true, schedule: true, messages: true, documents: true, leads: false, staff: false, money: false,
};

export interface SessionUser {
  userId: string;
  tenantId: string;
  email: string;
  role: Role;
  name: string;
  status?: string;              // "active" | "pending" | "suspended" (managers/staff)
  permissions?: Permissions;    // managers only
}

// Resolve once when Firebase Auth has restored any persisted session.
let _authReady: Promise<void> | null = null;
function authReady() {
  if (!_authReady) {
    _authReady = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth(), () => { unsub(); resolve(); });
    });
  }
  return _authReady;
}

export async function verifySession(): Promise<SessionUser | null> {
  if (hasDemoSession()) return demoUser(getDemoRole());
  if (isDemoBackend()) return null;
  await authReady();
  if (!auth().currentUser) return null;
  try {
    const d = await fbHandle("GET", "/api/auth");
    return (d.user as SessionUser) || null;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const id = email.trim();
  // Demo login shortcut: enters the in-browser mock (sample data, all portals via
  // /demo). No Firebase call — must run before signInWithEmailAndPassword, which
  // would reject "grigoryan" as an invalid email.
  if (id.toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD) {
    enableDemo();
    return demoUser("agency_admin");
  }
  await signInWithEmailAndPassword(auth(), id, password);
  clearProfileCache();
  const d = await fbHandle("GET", "/api/auth");
  return d.user as SessionUser;
}

const now = () => new Date().toISOString();
function genCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export interface SignupInput {
  role: SignupRole;
  name: string;
  email: string;
  password: string;
  phone?: string;
  agencyName?: string;  // role === "agency"
  joinCode?: string;    // role === "manager" (required); optional for family/caregiver
  onboarding?: Record<string, unknown>; // get-started answers, kept for admin review
}

// Create a real account and provision the right Firestore records.
// Agency  -> new tenant + join code + full service catalog, role agency_admin.
// Family/Caregiver -> join an existing agency by code, minimal profile.
export async function signUp(input: SignupInput): Promise<SessionUser> {
  const email = input.email.trim();
  const name = input.name.trim();
  const cred = await createUserWithEmailAndPassword(auth(), email, input.password);
  const uid = cred.user.uid;
  const D = db();
  clearProfileCache();
  try { if (name) await updateProfile(cred.user, { displayName: name }); } catch { /* non-fatal */ }

  // Platform super-admin: no tenant, no users doc — recognized by email everywhere.
  // (If the account already exists, they just sign in instead.)
  if (SUPERADMIN_EMAILS.includes(email.toLowerCase())) {
    return { userId: uid, tenantId: "", email, role: "platform_owner", name: name || "The Care Royal" };
  }

  if (input.role === "agency") {
    const tRef = doc(collection(D, "tenants"));
    const tenantId = tRef.id;
    const code = genCode();
    const agencyName = (input.agencyName || name || "My Agency").trim();
    const batch = writeBatch(D);
    // New agencies are WAITLISTED: status "pending" until The Care Royal platform
    // owner approves them. The agency portal shows a review screen until then.
    batch.set(tRef, { tenantId, name: agencyName, plan: "trial", status: "pending", joinCode: code, ownerUid: uid, ownerEmail: email, ownerName: name, createdAt: now() });
    // notifyEmail lets the public quote/apply forms route the agency's
    // new-request notification (this stack has no server-side Firestore).
    batch.set(doc(D, "joinCodes", code), { tenantId, agencyName, notifyEmail: email, createdAt: now() });
    batch.set(doc(D, "users", uid), { userId: uid, tenantId, role: "agency_admin", name, email, phone: input.phone || "", createdAt: now() });
    for (const s of DEFAULT_SERVICES) {
      batch.set(doc(collection(D, "services")), {
        tenantId, category: s.category, name: s.name, profileType: s.profileType,
        pricingModel: s.pricingModel, rate: "", credential: s.credential,
        durationMin: String(s.durationMin), active: "true",
      });
    }
    await batch.commit();
    return { userId: uid, tenantId, email, role: "agency_admin", name };
  }

  // family / caregiver / manager. A join code attaches them to an agency;
  // families & caregivers may also sign up WITHOUT a code (platform leads).
  // Everyone is WAITLISTED (status "pending") until approved.
  const code = (input.joinCode || "").trim().toUpperCase();
  const role: Role = input.role === "family" ? "family" : input.role === "manager" ? "manager" : "caregiver";
  const onboarding = input.onboarding || {};
  let tenantId = "";
  if (code) {
    const jc = await getDoc(doc(D, "joinCodes", code));
    if (!jc.exists()) {
      try { await cred.user.delete(); } catch { /* ignore */ }
      throw new Error("That agency code wasn't found. Please double-check it with the agency.");
    }
    tenantId = (jc.data() as { tenantId: string }).tenantId;
  } else if (role === "manager") {
    // Managers must join a specific agency — a code is required.
    try { await cred.user.delete(); } catch { /* ignore */ }
    throw new Error("Managers need their agency's sign-up code. Please ask your agency owner for it.");
  }
  const extra: Record<string, unknown> = {
    ...(role === "manager" ? { permissions: DEFAULT_MANAGER_PERMISSIONS } : {}),
    ...(Object.keys(onboarding).length ? { onboarding } : {}),
  };
  await setDoc(doc(D, "users", uid), {
    userId: uid, tenantId, role, name, email, phone: input.phone || "",
    status: "pending", source: code ? "code" : "self", ...extra, createdAt: now(),
  });
  if (tenantId && role === "family") {
    await setDoc(doc(collection(D, "households")), { tenantId, primaryUserId: uid, name: name ? `${name}'s household` : "My household", address: "", city: "", zip: "", createdAt: now() });
  } else if (tenantId && role === "caregiver") {
    await setDoc(doc(collection(D, "caregiverProfiles")), { tenantId, userId: uid, credentials: "", rate: "", bio: "", createdAt: now() });
  }
  return { userId: uid, tenantId, email, role, name, status: "pending", ...(role === "manager" ? { permissions: DEFAULT_MANAGER_PERMISSIONS } : {}) };
}

export async function signOutUser() {
  clearProfileCache();
  try { disableDemo(); } catch { /* ignore */ }          // clear demo session too
  try { await signOut(auth()); } catch { /* ignore */ }   // must finish before redirect
}
// Back-compat name used by PortalShell.
export function clearSession() { void signOutUser(); }

// Sign out fully, THEN hard-navigate to the login page. Awaiting the sign-out
// first prevents the login page from seeing a stale session and bouncing back;
// the redirect is basePath-aware so it lands on /app/login/ (not the root).
export async function signOutAndRedirect() {
  await signOutUser();
  if (typeof window !== "undefined") {
    const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
    window.location.href = `${bp}/login/`;
  }
}

export async function apiGet(path: string): Promise<any> {
  if (isDemoBackend()) return demoHandle("GET", path);
  return fbHandle("GET", path);
}
export async function apiPost(path: string, body: Record<string, unknown>): Promise<any> {
  if (isDemoBackend()) return demoHandle("POST", path, body);
  const r = await fbHandle("POST", path, body);
  if (r && (r as any).error) throw new Error((r as any).error);
  return r;
}
// Public (unauthenticated) POST — landing waitlist.
export async function publicPost(path: string, body: Record<string, unknown>) {
  if (isDemoBackend()) return demoHandle("POST", path, body);
  const r = await fbHandle("POST", path, body);
  if (r && (r as any).error) throw new Error((r as any).error);
  return r;
}

// ---- Platform-owner "view any agency's portal" (impersonation) --------------
// The super-admin picks a tenant + role; me() then reports that tenant/role so
// the portals load that agency's data (read-only via the isSuper() rule).
const ACTING_KEY = "cr_acting";
export function setActingTenant(tenantId: string, role: Role, agencyName?: string) {
  if (typeof window !== "undefined") localStorage.setItem(ACTING_KEY, JSON.stringify({ tenantId, role, agencyName: agencyName || "" }));
  clearProfileCache();
}
export function getActingTenant(): { tenantId: string; role: Role; agencyName?: string } | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(ACTING_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function clearActingTenant() {
  if (typeof window !== "undefined") localStorage.removeItem(ACTING_KEY);
  clearProfileCache();
}

export function homeForRole(role: Role): string {
  if (role === "platform_owner") return "/admin/";
  if (role === "caregiver") return "/caregiver/";
  if (role === "family") return "/family/";
  return "/agency/";
}
