// Client-side session + API helpers. Token/user live in localStorage.
import { isDemoBackend, hasDemoSession, getDemoRole, demoUser, demoHandle } from "./demo";

export type Role = "agency_admin" | "agency_coord" | "caregiver" | "family";
export interface SessionUser {
  userId: string;
  tenantId: string;
  email: string;
  role: Role;
  name: string;
}

const TOKEN_KEY = "cr_token";
const USER_KEY = "cr_user";

export function saveSession(token: string, user: SessionUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function authPost(payload: Record<string, unknown>) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

// Verify the session; returns the user or null. Demo-aware.
export async function verifySession(): Promise<SessionUser | null> {
  if (hasDemoSession()) return demoUser(getDemoRole());
  if (isDemoBackend()) return null; // static demo build, visitor not signed in
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/auth", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as SessionUser;
  } catch {
    return null;
  }
}

// Authenticated API calls (attach the Bearer token). Demo-aware.
export async function apiGet(path: string) {
  if (isDemoBackend()) return demoHandle("GET", path);
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  return handle(res);
}
export async function apiPost(path: string, body: Record<string, unknown>) {
  if (isDemoBackend()) return demoHandle("POST", path, body);
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body),
  });
  return handle(res);
}

// Public (unauthenticated) POST — used by the landing waitlist forms.
export async function publicPost(path: string, body: Record<string, unknown>) {
  if (isDemoBackend()) return demoHandle("POST", path, body);
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle(res);
}

// Where each role lands after login.
export function homeForRole(role: Role): string {
  if (role === "caregiver") return "/caregiver/";
  if (role === "family") return "/family/";
  return "/agency/";
}
