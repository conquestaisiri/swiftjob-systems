// Cloudflare Pages Function — reverse proxy /api/* to the Worker API.
// The Worker origin is read from the API_ORIGIN binding if configured,
// falling back to the default production Worker URL. Set API_ORIGIN as a
// Pages environment variable to override (e.g. a preview/pre-prod Worker).
const DEFAULT_API_ORIGIN =
  "https://swiftjob-workers-api.conquestsammy5.workers.dev";

export async function onRequest(context) {
  const origin = context.env?.API_ORIGIN || DEFAULT_API_ORIGIN;
  const url = new URL(context.request.url);
  const target = new URL(`${origin}${url.pathname}${url.search}`);
  const headers = new Headers(context.request.headers);
  headers.delete("host");

  const init = {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method)
      ? undefined
      : context.request.body,
    redirect: "follow",
  };

  const resp = await fetch(target.toString(), init);
  const respHeaders = new Headers(resp.headers);
  respHeaders.set("Access-Control-Allow-Origin", "*");
  respHeaders.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  );
  respHeaders.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
}
