/**
 * Called whenever an admin API returns 401 (expired/invalid token).
 * Clears the stored token and bounces the user back to the login screen so
 * every admin tab reacts the same way instead of silently showing stale or
 * empty data.
 */
export function handleAdminUnauthorized(): void {
  localStorage.removeItem("admin_token");
  const url = new URL(window.location.href);
  url.pathname = "/admin/login";
  url.search = "";
  url.hash = "";
  window.location.assign(url);
}

export function isUnauthorized(res: { status: number }): boolean {
  return res.status === 401;
}
