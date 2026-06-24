# Panel Planner launch advertisement

Self-hosted copy of the Claude shareable HTML advertisement provided for the RWAS Panel Planner page.

The original Claude-hosted URL cannot be framed directly by `rogerwilcoaviation.com` because the source response restricts `frame-ancestors` to Claude domains. The page is hosted here so `/panel-planner` can embed it as same-origin content under the site's existing `SAMEORIGIN` frame policy.

The bundled ad creates blob-backed script, font, and fetch resources at runtime; `public/_headers` allows `blob:` for those CSP directives.
