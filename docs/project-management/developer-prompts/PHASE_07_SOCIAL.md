# Phase 7 developer prompts — distribution

Context: Sharing must be factual. Do not generate OG images that contain sample profits. Do not scrape X, TikTok, or YouTube. UTM values are length-capped strings, never HTML.

P0 order: SOC-04, SOC-03, SOC-01. P1: SOC-02, SOC-05, then backlog P1-01, P1-02, P1-03.

### SOC-04
`robots.txt` disallows `/admin`. Sitemap of published non-illustrative challenges and episodes. Production build excludes slug `demo`.

### SOC-03
Copy canonical URL. Accessible “Copied” status. `navigator.share` when present. Prefill uses the document title only.

### SOC-01
Static unique `<title>` and meta description in built HTML for `/`, `/leaderboard`, `/methodology`, `/about`, `/privacy`, `/terms`, `/status`, `/episodes`. For `/challenge/:slug` and `/episodes/:slug`, implement ADR-003 **only after approval**. If ADR-003 is still pending, ship the static routes and write the gap into `PROJECT_STATUS.md` under blocked tasks. Never embed fake P&L in meta tags.

### SOC-02 (P1)
Typed analytics helpers for the events in UX §20. No request when the analytics id is empty or `navigator.doNotTrack` is `1`. Properties must not include emails, IPs, or wallet secrets.

### SOC-05 (P1)
Admin entry of a post URL and a manual metric snapshot with `provenance=manual`. Public pages hide counts when provenance is absent.

### P1-01
CSV leaderboard download with as-of, calc version, and source grade.

### P1-02
Optional extra chart series and transaction markers. No dual axis. Table fallback stays.

### P1-03
Migration `leaderboard_revisions`. Weekly job freezes rows. Same week rerun is idempotent. Public query `revision` reads the freeze, not the live snapshot.

**Commands:** package tests affected plus `pnpm --filter @belac/web build`.

**Done when:** methodology HTML title is present without JavaScript, and demo is absent from a production-mode sitemap. Next: PRD-01.

Completion report required.
