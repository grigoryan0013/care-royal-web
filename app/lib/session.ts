// Session + API helpers. Real mode = Firebase Auth + Firestore (client-side).
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, onAuthStateChanged, sendPasswordResetEmail,
} from "firebase/auth";
import { collection, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import { fbHandle, clearProfileCache } from "./fb";
import { DEFAULT_SERVICES } from "./catalog";
import { isDemoBackend, hasDemoSession, getDemoRole, demoUser, demoHandle, disableDemo } from "./demo";

// Username aliases: let the owner sign in with a short username instead of the
// full account email. Maps a typed username (lowercased) to its real login email.
// `grigoryan` is the platform owner's login — it resolves to the super-admin email
// (info@thecareroyal.com), NOT to any client account. grigoryan0013@gmail.com is a
// separate, plain CLIENT account and must never be reachable via this alias.
// `thecareroyal` is the Care Royal flagship AGENCY owner login (agency@thecareroyal.com,
// role agency_admin on tenant tn_careroyalhq) — full write access to the agency portal,
// distinct from the platform super-admin above.
const USERNAME_ALIASES: Record<string, string> = {
  grigoryan: "info@thecareroyal.com",
  thecareroyal: "agency@thecareroyal.com",
};

export type Role = "platform_owner" | "agency_admin" | "agency_coord" | "manager" | "caregiver" | "family";
// The Care Royal platform super-admins (recognized by login email — no tenant).
export const SUPERADMIN_EMAILS = ["info@thecareroyal.com"];
// Emails whose OWN agency skips the waitlist on self-signup. Empty by design:
// the platform owner is a super-admin (info@thecareroyal.com) and does NOT create
// an agency via signup — the Care Royal flagship tenant is provisioned directly and
// the owner reaches it from the /admin console. Every real agency signup is
// waitlisted (status "pending") until a super-admin approves it.
export const OWNER_BUSINESS_EMAILS: string[] = [];
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

// Resolve a typed identifier (email OR a known username) to the login email.
function resolveLoginEmail(typed: string): string {
  const t = typed.trim();
  return t.includes("@") ? t : (USERNAME_ALIASES[t.toLowerCase()] || t);
}

// True when an auth error means "this email already has an account" — the caller
// should offer sign-in / password reset instead of a dead end.
export function isAccountExistsError(e: unknown): boolean {
  return (e as { code?: string })?.code === "auth/email-already-in-use";
}

// Turn a Firebase auth error (or our own thrown Error) into ONE clear, calm
// sentence for the user. Never leaks "Firebase: Error (auth/...)" fragments.
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  switch (code) {
    case "auth/email-already-in-use": return "That email already has an account. Please sign in or reset your password.";
    case "auth/invalid-email": return "That doesn't look like a valid email address.";
    case "auth/missing-email": return "Please enter your email address.";
    case "auth/weak-password": return "Please choose a password with at least 6 characters.";
    case "auth/missing-password": return "Please enter a password.";
    case "auth/wrong-password":
    case "auth/invalid-credential": return "That email or password doesn't match. Try again or reset your password.";
    case "auth/user-not-found": return "We couldn't find an account with that email. Check the spelling, or create an account.";
    case "auth/too-many-requests": return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed": return "Network problem — check your connection and try again.";
  }
  // Our own clean Error (e.g. bad join code) — use its message as-is.
  const m = e instanceof Error ? e.message : "";
  if (m && !/firebase/i.test(m)) return m;
  return "Something went wrong. Please try again.";
}

// Send Firebase's secure password-reset email (a branded reset link). Works on
// the Spark plan, no backend. Accepts an email or a known username alias.
export async function resetPassword(emailOrUsername: string): Promise<void> {
  await sendPasswordResetEmail(auth(), resolveLoginEmail(emailOrUsername));
}

// Public email -> account-type index. Lets a blocked "email already in use"
// signup tell the user WHAT KIND of account already uses that email (client,
// caregiver, agency…). Low-sensitivity (role only); this trades enumeration
// privacy for clearer messaging, per the owner's request.
function emailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[/#?[\].]/g, "_");
}
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  agency_admin: "agency", agency_coord: "agency", manager: "manager",
  caregiver: "caregiver", family: "client", platform_owner: "platform",
};
export function accountTypeLabel(role: string): string { return ACCOUNT_TYPE_LABEL[role] || "an existing"; }

async function writeEmailIndex(email: string, role: Role): Promise<void> {
  try { await setDoc(doc(db(), "signupEmails", emailKey(email)), { email: email.trim().toLowerCase(), role, updatedAt: new Date().toISOString() }); } catch { /* non-fatal */ }
}

// What kind of account already uses this email? Returns a friendly label
// ("caregiver" / "client" / "agency" …) or null if unknown. Used for the
// "that email already has a __ account" message.
export async function lookupAccountType(emailOrUsername: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db(), "signupEmails", emailKey(resolveLoginEmail(emailOrUsername))));
    const role = snap.exists() ? (snap.data() as { role?: string }).role || "" : "";
    return role ? accountTypeLabel(role) : null;
  } catch { return null; }
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  // A bare username (no "@") maps to its real account email; otherwise sign in
  // with the email as given. Real Firebase Auth — no demo mock.
  const id = resolveLoginEmail(email);
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
  // One account per email — Firebase Auth rejects a duplicate email, so the same
  // email can never create a second account (or a second role). We let the
  // FirebaseError (code auth/email-already-in-use) propagate so callers can map
  // it via authErrorMessage() AND look up which account type already exists via
  // lookupAccountType(). (Applies to every signup entry point, and to the future
  // self-serve marketplace, which reuses this path.)
  const cred = await createUserWithEmailAndPassword(auth(), email, input.password);
  const uid = cred.user.uid;
  const D = db();
  clearProfileCache();
  try { if (name) await updateProfile(cred.user, { displayName: name }); } catch { /* non-fatal */ }

  // Platform super-admin: no tenant, no users doc — recognized by email everywhere.
  // (If the account already exists, they just sign in instead.)
  if (SUPERADMIN_EMAILS.includes(email.toLowerCase())) {
    await writeEmailIndex(email, "platform_owner");
    return { userId: uid, tenantId: "", email, role: "platform_owner", name: name || "The Care Royal" };
  }

  if (input.role === "agency") {
    const tRef = doc(collection(D, "tenants"));
    const tenantId = tRef.id;
    const code = genCode();
    const agencyName = (input.agencyName || name || "My Agency").trim();
    // Firestore rules can't see other writes in the same batch, and the hardened
    // users-create rule requires the tenant to already exist (owned by uid) before
    // the owner's profile is written, and the owner profile to exist before the
    // services rule's isAgency() check resolves. So commit in three ordered steps.
    // 1) Tenant + its join code. New agencies are WAITLISTED: status "pending"
    //    until The Care Royal platform owner approves them.
    const b1 = writeBatch(D);
    const agencyStatus = OWNER_BUSINESS_EMAILS.includes(email.toLowerCase()) ? "active" : "pending";
    b1.set(tRef, { tenantId, name: agencyName, plan: "trial", status: agencyStatus, joinCode: code, ownerUid: uid, ownerEmail: email, ownerName: name, createdAt: now() });
    // notifyEmail lets the public quote/apply forms route the agency's
    // new-request notification (this stack has no server-side Firestore).
    b1.set(doc(D, "joinCodes", code), { tenantId, agencyName, notifyEmail: email, createdAt: now() });
    await b1.commit();
    // 2) Owner profile (now the tenant exists and names uid as owner).
    await setDoc(doc(D, "users", uid), { userId: uid, tenantId, role: "agency_admin", name, email, phone: input.phone || "", createdAt: now() });
    // 3) Seed the default service catalog.
    const b3 = writeBatch(D);
    for (const s of DEFAULT_SERVICES) {
      b3.set(doc(collection(D, "services")), {
        tenantId, category: s.category, name: s.name, profileType: s.profileType,
        pricingModel: s.pricingModel, rate: "", credential: s.credential,
        durationMin: String(s.durationMin), active: "true",
      });
    }
    await b3.commit();
    await writeEmailIndex(email, "agency_admin");
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
    status: "pending", source: code ? "code" : "self", joinCode: code, ...extra, createdAt: now(),
  });
  if (tenantId && role === "family") {
    await setDoc(doc(collection(D, "households")), { tenantId, primaryUserId: uid, name: name ? `${name}'s household` : "My household", address: "", city: "", zip: "", createdAt: now() });
  } else if (tenantId && role === "caregiver") {
    await setDoc(doc(collection(D, "caregiverProfiles")), { tenantId, userId: uid, credentials: "", rate: "", bio: "", createdAt: now() });
  }
  await writeEmailIndex(email, role);
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
