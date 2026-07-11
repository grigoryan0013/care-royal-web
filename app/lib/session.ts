// Session + API helpers. Real mode = Firebase Auth + Firestore (client-side).
// Demo mode (grigoryan/201816) = in-browser mock, still available for testing.
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { fbHandle, clearProfileCache } from "./fb";
import { isDemoBackend, hasDemoSession, getDemoRole, demoUser, demoHandle } from "./demo";

export type Role = "agency_admin" | "agency_coord" | "caregiver" | "family";
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
