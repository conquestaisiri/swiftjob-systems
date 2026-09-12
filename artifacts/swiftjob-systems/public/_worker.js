// Cloudflare Pages _worker.js — serves the SPA and reverse-proxies /api/* to
// the Worker API. Kept in the Vite public dir so every build carries it into
// dist/public and wrangler pages deploy picks it up as the Pages worker.
const DEFAULT_API_ORIGIN =
  "https://swiftjob-workers-api.conquestsammy5.workers.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/sitemap.xml") {
      const origin = env.API_ORIGIN || DEFAULT_API_ORIGIN;
      const target = new URL(`${origin}/api/sitemap.xml`);
      const resp = await fetch(target.toString(), {
        method: "GET",
        headers: { Accept: "application/xml" },
      });
      if (resp.ok) {
        return new Response(resp.body, {
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers,
        });
      }
      // Keep a build-time sitemap available if the API is temporarily down.
      return env.ASSETS.fetch(request);
    }

    if (url.pathname.startsWith("/api/")) {
      const origin = env.API_ORIGIN || DEFAULT_API_ORIGIN;
      const target = new URL(`${origin}${url.pathname}${url.search}`);
      const headers = new Headers(request.headers);
      headers.delete("host");

      const init = {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method)
          ? undefined
          : request.body,
        redirect: "follow",
      };

      const resp = await fetch(target.toString(), init);
      const respHeaders = new Headers(resp.headers);
      const requestOrigin = request.headers.get("Origin");
      let sameOrigin = false;
      if (requestOrigin) {
        try {
          sameOrigin = new URL(requestOrigin).origin === url.origin;
        } catch {
          sameOrigin = false;
        }
      }
      respHeaders.set(
        "Access-Control-Allow-Origin",
        sameOrigin ? requestOrigin : url.origin,
      );
      respHeaders.set("Vary", "Origin");
      respHeaders.set(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      );
      respHeaders.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Idempotency-Key",
      );

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
