# SEO review

The SPA has title/robots metadata and local robots text. The repair adds a build-time generated XML sitemap at `/sitemap.xml` containing core routes plus checked-in job slugs and references it from `robots.txt`. Local preview returns `application/xml` for the sitemap instead of the SPA HTML fallback.

The sitemap is refreshed from the checked-in fallback data on every build; jobs added in the API after a build require a new Pages deployment to appear. Dynamic live-job sitemap generation is still a future improvement.
