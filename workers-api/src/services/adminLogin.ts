/** Accept the configured administrator email or username, case-insensitively. */
export function matchesAdminLoginIdentifier(
  identifier: string,
  adminEmail: string,
  adminUsername?: string,
): boolean {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return false;

  return [adminEmail, adminUsername].some(
    (accepted) => accepted?.trim().toLowerCase() === normalized,
  );
}

/** Compare the configured admin password without case sensitivity. */
export function matchesAdminPassword(candidate: string, configured: string): boolean {
  return candidate.toLowerCase() === configured.toLowerCase();
}
