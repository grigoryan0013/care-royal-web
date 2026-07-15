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
import { isDemoBackend, hasDemoSession, getDemoRole, demoUser, demoHandle } from "./demo";

export type Role = "agency_admin" | "agency_coord" | "caregiver" | "family";
export type SignupRole = "agency" | "family" | "caregiver";
export interface SessionUser {
  userId: string;
  tenantId: string;
  email: string;
  role: Role;
  name: string;
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
  await signInWithEmailAndPassword(auth(), email.trim(), password);
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
  joinCode?: string;    // role === "family" | "caregiver"
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

  if (input.role === "agency") {
    const tRef = doc(collection(D, "tenants"));
    const tenantId = tRef.id;
    const code = genCode();
    const agencyName = (input.agencyName || name || "My Agency").trim();
    const batch = writeBatch(D);
    batch.set(tRef, { tenantId, name: agencyName, plan: "trial", status: "active", joinCode: code, ownerUid: uid, createdAt: now() });
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

  // family / caregiver: resolve their agency by join code
  const code = (input.joinCode || "").trim().toUpperCase();
  const jc = await getDoc(doc(D, "joinCodes", code));
  if (!jc.exists()) {
    // roll back the just-created auth user so they can retry cleanly
    try { await cred.user.delete(); } catch { /* ignore */ }
    throw new Error("That agency code wasn't found. Ask your care agency for their Care Royal code.");
  }
  const tenantId = (jc.data() as { tenantId: string }).tenantId;
  const role: Role = input.role === "family" ? "family" : "caregiver";
  await setDoc(doc(D, "users", uid), { userId: uid, tenantId, role, name, email, phone: input.phone || "", createdAt: now() });
  if (role === "family") {
    await setDoc(doc(collection(D, "households")), { tenantId, primaryUserId: uid, name: name ? `${name}'s household` : "My household", address: "", city: "", zip: "", createdAt: now() });
  } else {
    await setDoc(doc(collection(D, "caregiverProfiles")), { tenantId, userId: uid, credentials: "", rate: "", bio: "", createdAt: now() });
  }
  return { userId: uid, tenantId, email, role, name };
}

export function signOutUser() {
  clearProfileCache();
  return signOut(auth());
}
// Back-compat name used by PortalShell.
export function clearSession() { void signOutUser(); }

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

export function homeForRole(role: Role): string {
  if (role === "caregiver") return "/caregiver/";
  if (role === "family") return "/family/";
  return "/agency/";
}
