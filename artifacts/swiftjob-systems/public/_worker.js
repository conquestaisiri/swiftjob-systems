// Cloudflare Pages _worker.js — serves the SPA and reverse-proxies /api/* to
// the Worker API. Kept in the Vite public dir so every build carries it into
// dist/public and wrangler pages deploy picks it up as the Pages worker.
const DEFAULT_API_ORIGIN =
  "https://swiftjob-workers-api.conquestsammy5.workers.dev";
const PUBLIC_ORIGIN = "https://swiftjob.online";

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function replaceOrInsert(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, `\n    ${tag}`);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function withStrictTransportSecurity(response) {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", "max-age=31536000");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function rewriteDocumentMetadata(response, requestUrl) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return response;

  return response.text().then((html) => {
    const pathname = requestUrl.pathname || "/";
    const canonicalUrl = `${PUBLIC_ORIGIN}${pathname}`;
    const privateRoute = /^\/(admin|candidate|login|assessment|r(?:\/|$))/.test(
      pathname,
    );
    const robots = privateRoute ? "noindex, nofollow" : "index, follow";
    let rewritten = html;
    rewritten = replaceOrInsert(
      rewritten,
      /\s*<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />`,
    );
    rewritten = replaceOrInsert(
      rewritten,
      /\s*<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i,
      `<meta property="og:url" content="${escapeAttribute(canonicalUrl)}" />`,
    );
    rewritten = replaceOrInsert(
      rewritten,
      /\s*<meta\b[^>]*\bname=["']robots["'][^>]*>/i,
      `<meta name="robots" content="${robots}" />`,
    );

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(rewritten, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}

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
        return withStrictTransportSecurity(new Response(resp.body, {
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers,
        }));
      }
      // Keep a build-time sitemap available if the API is temporarily down.
      return withStrictTransportSecurity(await env.ASSETS.fetch(request));
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

      return withStrictTransportSecurity(new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      }));
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withStrictTransportSecurity(
      await rewriteDocumentMetadata(assetResponse, url),
    );
  },
};
