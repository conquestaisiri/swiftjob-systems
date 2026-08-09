import { handleAdminUnauthorized } from "@/lib/adminAuth";

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function getAdminToken(): string | null {
  return localStorage.getItem("admin_token");
}

export function setAdminToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearAdminToken() {
  localStorage.removeItem("admin_token");
}

/**
 * Authenticated admin fetch. Attaches the bearer token, and on 401 clears the
 * session and bounces to the login page. Throws on non-OK responses.
 */
export async function adminFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    clearAdminToken();
    handleAdminUnauthorized();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return res;
}
