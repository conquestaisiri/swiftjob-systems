# SEO review

The SPA has title/robots metadata and local robots text. `/sitemap.xml` contains the core routes plus active job slugs and is referenced from `robots.txt`. The production Pages Worker now proxies this path to the Worker API, which reads the live public-job list on every request and returns XML with `no-store`; the build-time sitemap remains a fallback when the API is temporarily unavailable. Production smoke returned 100 URLs and valid XML.
