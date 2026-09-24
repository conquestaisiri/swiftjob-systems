import { getEnv } from "../config";

const CANONICAL_SITE_URL = "https://swiftjob.online";

/** Keep outbound links and email assets on SwiftJob's canonical .online domain. */
export function getPublicSiteUrl(): string {
  const configured = (getEnv().FRONTEND_URL ?? "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const hostname = url.hostname.toLowerCase();
      if (
        url.protocol === "https:" &&
        (hostname === "swiftjob.online" || hostname.endsWith(".swiftjob.online"))
      ) {
        return url.origin;
      }
    } catch {
      // Use the canonical production origin below when configuration is invalid.
    }
  }
  return CANONICAL_SITE_URL;
}
