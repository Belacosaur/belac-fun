# Phase 5 developer prompts — public website

Context: Presentation follows `uiux_design.md`. Numbers follow the API. Never hardcode `$108.42` or other sample totals. If `isIllustrative` is true, show a banner: “Sample data. Not a real result.” Campaign eyebrow may say the experiment is live only when campaign state is `active` (ADR-006). Data freshness uses Current, Stale, Estimated, or Manual — not the word Live. No wallet connect, no trade buttons.

Display: `en-AU` grouping, USD, Australia/Perth default with a UTC toggle stored in `localStorage` key `belac.timeZone`. ROI 2 decimals. Unknown money is not `$0`. Confirmed liquidation may be `$0` with the wipeout sentence from UX §16.

Read UX §5–9, §11, §14–16. Order: WEB-01 through WEB-10.

### WEB-01
Header, footer, mobile sheet, skip link, 1280px content width, 44px targets, focus color `--focus`. Nav: Overview, Leaderboard, Episodes, Methodology, About. No wallet control.

### WEB-02
Components `Money`, `SourceBadge`, `UpdateBadge`, `KPIBlock`, `EmptyState`. Tests for +, −, zero, unknown, and each source grade. Text plus color.

### WEB-03
Homepage from API summary and leaderboard. States: loading skeletons with stable height, error, pre-start copy from UX §16, illustrative banner. Primary CTA to `/leaderboard`. Secondary to `/methodology`.

### WEB-04
`/leaderboard`: sort metric, status filter, source filter, name search, reset. 24H and 7D controls visible and disabled with an explanation. Table on wide screens, cards below 768px. Note that risk and time in market differ. No CSV control.

### WEB-05
`/challenge/:slug`: breadcrumb, “Provider used for experiment”, value block, risk panel, proof list, fees, rules. Sticky anchors Overview, Performance, Transactions, Updates, Rules. Unpriced: “Value unavailable” and no new ROI. Explorer links only for `http:` and `https:`.

### WEB-06
Methodology (formula, grades, no financial advice, method version `v1`), about, privacy (no account required), terms, status from `/v1/site/status` with an error state. Home disclaimer links here.

### WEB-07
Episodes list and detail. Iframe only after Play. Host allowlist: `youtube.com`, `youtube-nocookie.com`, `www.tiktok.com`, `x.com`. Else an external link. No autoplay.

### WEB-08
One chart library. USD equity and a horizontal $100 baseline. Do not connect gaps across nulls. Accessible table with the same points. Respect `prefers-reduced-motion`. No second axis.

### WEB-09
Implement the copy map in UX §16 and test each string. Assert the rendered tree does not contain `NaN`.

### WEB-10
Route tests. Logged-out `/admin` shows “Sign-in required” and no inputs. Nav button min-height is at least 44.

**Commands:** `pnpm --filter @belac/web test && pnpm --filter @belac/web build && pnpm typecheck`.

**Done when:** journeys can be clicked locally against the demo seed and the illustrative banner is visible. Next: ADM-01.

Completion report required. Do not claim browser-matrix completion; that is PRD-04.
