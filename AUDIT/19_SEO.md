# SEO review

The SPA has route-specific titles, descriptions, canonical URLs, Open Graph URLs,
and robots metadata. Public routes remain indexable; candidate, admin, login,
assessment, and referral handoff screens are marked `noindex, nofollow`.
The Pages edge worker now rewrites canonical, Open Graph URL, and robots tags in
the direct HTML response as well, so crawlers and link unfurlers receive the
correct route metadata before JavaScript runs. A live crawl of all 100 sitemap
URLs returned HTTP 200, a title, and a matching production canonical URL.
`/sitemap.xml` contains the core routes plus active job slugs and is referenced
from `robots.txt`. The production Pages Worker now proxies this path to the
Worker API, which reads the live public-job list on every request and returns
XML with `no-store`; the build-time sitemap remains a fallback when the API is
temporarily unavailable. Production smoke returned 100 URLs and valid XML.
