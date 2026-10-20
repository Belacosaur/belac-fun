# BELAC.FUN — COMPREHENSIVE UI/UX DESIGN SPECIFICATION
**Version:** 1.0 | **Date:** 20 October 2026 | **Status:** Build-ready product design blueprint  
**Companion:** `architecture.md` | **Platform:** responsive web, mobile-first | **Domain:** `belac.fun`

## 1. Product thesis and design principles
Belac.fun documents a public, 30-day $100 DeFi experiment: 10 independent strategies, $10 each, across distinct providers. Its central promise is **show the money, show the proof, show the process**. People arrive from X, TikTok or YouTube Shorts; they should understand the rules and current results in 5 seconds, explore individual experiments without signing in, and follow future episodes.

The website is a documentary-style, public-facing analytics and media product—not a trading terminal, not investment advice, not a wallet, not a casino gateway. It must display unfavourable outcomes as clearly as profitable ones.

**Principles:**
1. **Proof before hype:** label verified vs reported vs manually entered numbers at point of use.
2. **One glance, then drill down:** clear summary and ranking, with fees/methodology beneath.
3. **Mobile-first social landing:** fast, legible, thumb-friendly; optimized for link traffic.
4. **Narrative + evidence:** each provider is both a story/episode and a reproducible ledger.
5. **No manufactured urgency:** no fake countdowns, implied guaranteed returns, or emotionally manipulative risk cues.
6. **Consistent financial semantics:** values are always USD unless explicitly switched; timestamps and data staleness visible.
7. **Accessible by design:** WCAG 2.2 AA target; charts always have textual equivalents.
8. **Belac identity:** bold independent personality with a measured visual language; avoid default corporate-blue styling.

## 2. Goals, non-goals and success measures
### Primary goals
- Demonstrate the 10-strategy experiment transparently and accurately.
- Convert social viewers into engaged visitors who understand and revisit the challenge.
- Give protocol teams direct, shareable pages that fairly document their product usage.
- Make updating, verifying and publishing routine for one operator.
- Support daily shorts and weekly recap publishing with stable permanent links.

### Non-goals
- Let visitors connect wallets, execute orders, copy strategies or send deposits.
- Claim a profit is realised when it is only a mark-to-market estimate.
- Fabricate live prices or automatically present unverified off-chain balances as verified.
- Optimise interfaces to drive casino play or leveraged speculation.

### Product KPIs
Sessions via social UTM, engaged visits, episode-to-challenge click-through, return visit rate (privacy-conscious aggregate), outbound visits to official provider websites, video play rate, share/copy-link actions, methodology engagement, stale-data error rate, update latency, operator publishing time. Do not treat profitable performance as a UX success measure.

## 3. Users and jobs to be done
| Persona | Trigger | Need | Success |
|---|---|---|---|
| X scroller | Sees a provider-tagged daily post | Know result in seconds | Sees P&L and clicks the featured challenge |
| TikTok/Shorts viewer | Watches a clipped update | See proof without jargon | Lands on mobile challenge page and validates the number |
| Crypto-literate visitor | Doubts performance claims | Transactions, sources, fees, comparable methodology | Can independently reproduce a result or understand why not |
| Protocol/community manager | Mentioned in post | Fair and accurate project spotlight | Shareable link with correct name and evidence |
| Returning fan | Wants update | What's new since last visit? | Finds latest episode and changed standings |
| Operator/editor | Daily capture + post | Publish in minutes without altering ledgers accidentally | Update, review, publish and verify visibly |

## 4. Information architecture
```text
/
├── /challenge                      Overview / complete standings
├── /challenge/[slug]               Detail per strategy/provider
│   ├── #performance                Values & chart
│   ├── #activity                   Trades, fills, fees, proof
│   ├── #updates                    Daily posts / video episodes
│   └── #method                     Strategy-specific rules
├── /episodes                       Timeline of video content
├── /episodes/[slug]                Transcript, embed, related challenges
├── /leaderboard                    Dense compare / advanced filters
├── /methodology                    Accounting, sources, risks and definitions
├── /about                          Why the challenge exists / disclosures
├── /status                         Data freshness / integrations incidents
├── /privacy                        Privacy policy
├── /terms                          Terms / risk and legal notices
└── /admin                          Private, server-authenticated workspace
    ├── /overview                   Operations health
    ├── /challenges                 Manage challenge metadata
    ├── /transactions               Ingestion & reconciliation inbox
    ├── /prices                     Source coverage and override review
    ├── /episodes                   Draft/edit/schedule/publish
    ├── /media                      Asset upload / alt text
    ├── /social                     Post links and attribution
    ├── /audit                      Immutable change history
    └── /settings                   Campaign dates, providers, access
```
Use canonical lowercase clean slugs. Redirect retired slugs permanently; never reuse a slug for a different provider. Pages should have stable canonical URLs and meaningful metadata even before client-side JavaScript executes. Vite SPA alone does not reliably provide dynamic per-route social metadata; implement prerender/SSG or a server/edge metadata rendering layer for public detail pages. Keep Railway the sole source of financial truth.

## 5. Navigation and layout
### Global mobile (320–767px)
Header: Belac.fun wordmark left, compact active-challenge pill in centre where space allows, menu button right. Menu sheet contains Overview, Leaderboard, Episodes, Methodology, About. Use a sticky bottom action only where it genuinely helps (e.g., 'View standings'), never cover transaction tables or cookie choices. Safe-area support; scroll-based section anchors; sticky sectional tabs on challenge detail after hero.

### Tablet (768–1199px)
Two-column summary layout; leaderboard full width; challenge cards in two columns; collapsible charts and activity filters.

### Desktop (1200px+)
Max content width ~1280px with 12-column grid and 24px gutters; top persistent navigation; compact right rail for latest episode or context only when it does not reduce data readability. Financial tables have comfortable row density and a compact toggle.

### Responsive behavior
- 320–375px: single-column, no horizontal card overflow; table converts to semantic ranked cards with visible values and drilldowns.
- 376–767px: cards plus compact sparklines.
- 768–1199px: 2-column cards and 2-column summary.
- 1200px+: 3-column cards, table comparison, sticky sidebar optional.
- Do not hide precision, proof, uncertainty or disclosures solely because viewport is narrow.

## 6. Brand, art direction and design tokens
**Art direction:** bold, editorial, technical and entertaining: crypto-experiment lab meets transparent sports scoreboard. The website should look distinctive but not like a gambling product. Avoid bright corporate blue. All colors below are proposed, not finalized assets.

### Core palette (dark-first, accessible)
| Token | Suggested value | Purpose |
|---|---|---|
| `--bg` | `#0E0D0B` | Main canvas |
| `--surface` | `#191714` | Cards |
| `--surface-elevated` | `#24211D` | Menus/dialogs |
| `--border` | `#39342E` | Dividers |
| `--text-primary` | `#F7F2E9` | Primary type |
| `--text-secondary` | `#B9B1A5` | Secondary type |
| `--accent` | `#F3AE43` | Belac amber highlights |
| `--positive` | `#6BDF96` | Positive P&L only |
| `--negative` | `#FF7A79` | Negative P&L only |
| `--info` | `#C0ABFF` | Status/help; not profit |
| `--focus` | `#FFE7A3` | Strong keyboard focus |

Use textual +/− signs, arrows and labels in addition to color. Contrast validation required for every size/weight; adjust tokens to meet WCAG 2.2 AA before implementation. Offer light theme later only if fully tested. Use project-approved local system or licensed fonts; no dependency on remote fonts for basic render.

### Type, spacing and shape
Display heading: expressive geometric sans, 600–750 weight; body: neutral sans 400–600; tabular financial numerals `font-variant-numeric: tabular-nums`. Suggested sizes: display 48/56 desktop, 34/40 mobile; H1 34/40 desktop 28/34 mobile; H2 26/32; H3 20/26; body 16/24; label 13/18 minimum except low-priority legal info 12/18. 4px base spacing; layout steps 4,8,12,16,24,32,48,64. Buttons min 44px touch target; card radius 14–18px; inputs 10px; no heavy shadows on dark UI.

### Motion
150–250ms transitions with reduced-motion support. Rank changes animate only when genuine new snapshots arrive, not continuously. No fake tickers, flashing profit figures or dramatic loss animation. Chart hover/focus highlights exact datapoints; loading placeholders stable height to avoid layout shift.

## 7. Homepage: complete annotated specification
### 7.1 First viewport (mobile)
1. Wordmark and unobtrusive navigation.
2. Eyebrow: `LIVE EXPERIMENT · DAY 12 OF 30` **only while the campaign is active**, else `CAMPAIGN COMPLETE`.
3. H1: `Can $100 survive 10 DeFi strategies?` (or tested equivalent).
4. Plain-language subtitle: `$10 in each. Ten different platforms. Every trade and fee tracked.`
5. **Primary value** large `$108.42` with persistent label `Portfolio value · USD`.
6. `Net P&L +$8.42 (+8.42%)` and second metadata line `As of 20 Oct, 10:45 AWST · 9/10 positions current` (illustrative, source-driven).
7. Hero CTA `Explore the leaderboard`, secondary `How we calculate results`.
8. Compact comparison strip: Best performer; worst performer; fees to date; last verified update. Never imply all are verified when one is estimated.
9. Small disclaimer linking methodology and risks, not a blocking modal.

### 7.2 Rankings zone
Default sortable list sorted by net return % desc, with a control for dollar P&L, starting allocation, final net liquidation estimate, verification grade. For each: rank, protocol logo, strategy label, start $10, current value, $ and % P&L, tiny sparkline, source freshness indicator and an accessible `View [protocol]` link. Show ties explicitly. Positive and negative use sign plus color; zero neutral. Provide metric tooltips in plain English. For collapsed positions still show `$0` where liquidation/wipeout confirmed, otherwise `Unknown` until reconciled.

### 7.3 Narrative / content zone
Featured episode thumbnail (16:9) with duration, platform badge, publish date and clear outbound/video source. The latest timeline consists of 3–6 update cards; section footer `All episodes`. Place it after leaderboard on mobile, beside lower-page chart on desktop if space allows. Next: comparison chart `Portfolio vs original $100` with timeline and as-of note. Then a trust panel `How these numbers are verified` with three source types and methodology link. Then provider list and footer links.

### Homepage wireframe (mobile)
```text
┌──────────────────────────────┐
│ BELAC.FUN               ☰   │
│ 10 PROTOCOLS  · DAY 12/30    │
│ Can $100 survive             │
│ 10 DeFi strategies?          │
│                              │
│ PORTFOLIO VALUE · USD        │
│ $108.42                      │
│ +$8.42  (+8.42%)             │
│ Last update: 10:45 AWST      │
│ [Explore standings] [How?]  │
├──────────────────────────────┤
│ LEADERBOARD       Sort: ROI │
│ 01 Axiom      +42.0%      >  │
│ 02 Meteora     +8.2%      >  │
│ 03 Jupiter     +5.1%      >  │
│ ... 10 rows                  │
├──────────────────────────────┤
│ LATEST EPISODE               │
│ ┌──────────────────────────┐ │
│ │     VIDEO THUMBNAIL      │ │
│ └──────────────────────────┘ │
│ What happened on day 12?    │
├──────────────────────────────┤
│ PORTFOLIO HISTORY           │
│ [Accessible line chart]     │
│ Methodology / Risks / About │
└──────────────────────────────┘
```

## 8. Leaderboard and comparison experience
Dedicated `/leaderboard` page includes title, methodology shortcut, as-of time and data-completeness banner. Controls: metric (return %, USD P&L, current value), timeframe (full campaign, 7D, 24H only when snapshots support it), status (all/open/closed/liquidated), risk class (filter), source quality (filter). Reset filters button. Search protocols by name. No comparison pretending to be apples-to-apples where positions differ in exposure/risk; include a `Risk and time in market differ` note. Export CSV of public computed metrics with source timestamp and method version.

Desktop semantic table columns: rank, provider, strategy, initial, current/exitable, net P&L, ROI, fees, source type, as-of. Sort icons have screen reader hints. Mobile ranked cards preserve same essential information and open details. Empty state states why (campaign not started, filters found no matches, unavailable feeds) and offers relevant action.

## 9. Challenge detail: full page specification
`/challenge/[slug]` must answer: **What was done? What's it worth? Where is the proof? What did we learn?**

### Sections (ordered)
1. Breadcrumb `Home / Challenges / [Provider]` and provider identity (logo, official verified website link, strategy category). Use `Provider used for experiment` rather than an implied endorsement.
2. Headline `Can $10 in [strategy] make money in 30 days?`; status `Active / Closed / Liquidated / Data stale / Pending reconciliation`.
3. Value block: initial amount, current estimated net exit value, net P&L $, ROI %, earned yield/fees where applicable; as-of, quote currency and source-quality badge.
4. Risk mini-panel: leverage for derivatives, liquidation price only if trusted, collateral state, LP pool/token exposure and impermanent loss, or memecoin liquidity/slippage where relevant.
5. Chart with value and transactions markers; toggles USD/SOL and campaign/date range. **Never put both series on the same unlabeled axis.** Chart can show discontinuities/unknowns rather than joining missing data.
6. Proof section: transaction list grouped by day, signature explorer links, provider receipts/screenshots if supported, ingestion source, last check, reconciliation flags.
7. Fee breakdown: swaps, network, funding, borrow interest, vault costs, realised LP fees, estimated exit costs with clear provenance; avoid double counting.
8. Episode strip: related posts/videos with timestamps, short summaries, link to all.
9. Lessons learned / qualitative review: setup friction, usability, surprise fees, practical $10 viability; operator opinion labelled as such.
10. Provider background / external official docs, non-affiliation statement, glossary and CTA to compare another challenge.

### Sticky detail nav
`Overview · Performance · Transactions · Updates · Rules` for long pages. On small phones, horizontally scrollable tabs with visible focus and no hidden rightmost content.

### Proof drawer
For each trade/position event show source type, external transaction ID, timestamp UTC + localized toggle, amounts as integers formatted by token decimals, all charged fees, ingestion timestamp, receipt/screenshot if applicable, reconciliation status, and any manual correction with public reason. Copies give feedback via `Copied`. Do not expose internal API credentials, wallet secrets, owner PII or unredacted exchange account IDs.

### Missing data states
`Last verified 5 hours ago` prominent but nonalarmist; don't recalculate ROI off a partially missing mark. If no price, show `Value unavailable` with previous valid mark and reason. If unsupported protocol, `Provider-reported, not independently verified` adjacent to value. If liquidation fully confirmed, show closed-out loss clearly instead of `—`.

## 10. Episodes and media library
Episode index `/episodes`: chronological feed with thumbnail, title, duration, day, mentioned protocol(s), short hook, date and links to X/TikTok/YouTube source. Filters by platform, provider, event (`entry`, `trade`, `surprise`, `weekly recap`, `final`). Episode detail is a shareable landing page, with properly sized poster, embed with privacy-aware lazy loading, optional direct link, transcript/captions, related transactions, cards of referenced challenge pages and a concise `What changed today` summary.

**Content model:** episode title, canonical slug, summary, publish_at, providers[], campaign_day, video channel URLs, local poster R2 key, optional captions/transcript, CTA text/url (restricted to internal), social post IDs/UTMs, disclosure markers, status draft/review/scheduled/published.

For short-form inbound routes, support `?utm_source=x&utm_medium=social&utm_campaign=100defi&utm_content=d12_...` without allowing untrusted values to inject markup. Share buttons: copy page link, native share where browser supports, open relevant official social post. Do not automatically trigger embeds without consent if privacy requirements call for opt-in.

## 11. Methodology and trust centre
Explain the portfolio in direct language:
- Ten budgets of `$10 USD`, money never added after start; all subsequent trades use proceeds in same bucket.
- Fixed experiment window and exact start/end UTC timestamp (display AWST to users).
- Net return after all recognised fees, with a documented fallback when exit fees are estimates.
- Definitions: principal, cash, realised P&L, unrealised P&L, mark price, exitable value, collateral, funding, borrow APR, protocol reward, impermanent loss.
- Rules for token decimal precision, price timestamps, unavailable liquidity, unpriced positions, stablecoin deviation and partial settlement.
- Source-level trust grades: **On-chain verified**, **Venue API reported**, **Manual evidence**, **Estimated**; badge must refer to specific figure not entire provider indiscriminately.
- Rankings are indicative when positions use heterogeneous risks. Include original $100 baseline and optional equal-weight 10 × $10 flat cash baseline.
- Provider relationships/affiliations/sponsorships disclosed, and creator may use product regardless of endorsement.
- No financial advice. No guarantee of profitability. Losses can be total; leveraged positions may liquidate; external providers have distinct access restrictions.

Publish a machine-readable methodology version and display `Method version v1.0` adjacent to exports. Corrections receive timestamp, reason and before/after effect.

## 12. Admin UX and operator journeys
### Admin design principles
Separate finance data from editorial copy. Never provide `Edit current balance` as an unchecked freeform action: adjustments require ledger correction and reason, ideally two-step confirmation. Separate `Save draft`, `Publish`, `Reconcile` and `Mark source verified`. Operations dashboard should make the next required action obvious.

### A. Daily operating dashboard `/admin/overview`
Queue widgets: unreconciled events, stale positions, pricing exceptions, posts due, broken media, failed import jobs. Today action checklist: verify balances, approve event diffs, render daily chart, update caption, publish post, verify public display. Last job execution and oldest unhandled warning visible; drilldown to event-level error. Operator can safely retry a failed import idempotently.

### B. Transaction intake `/admin/transactions`
Filters by provider, challenge, type, state, period. Each pending row shows detected transfer, expected effect, source, duplicate risk and linked original event. Side-by-side `Detected` vs `Existing` for partial fill/reorg review. Actions: accept, reject, attach evidence, request provider refresh. Manual entry wizard requires event type, date, symbol IDs, amounts, trade/receipt ID if present, fee details, position linkage, source grade, supporting evidence, and explanation. Review preview shows effect on net P&L; save is auditable and cannot be silently deleted. Corrections reverse/replace old entries.

### C. Challenge manager `/admin/challenges`
Create/edit challenge metadata: provider, strategy, target start, funded timestamp, wallet/account reference, operational accessibility, min order, fee notes, verification method, background copy, image, risk class, links, status. Lock budget/allocation once challenge has recognised events; changes require audited campaign amendment. Slug editing requires redirect creation. Preview before public publish.

### D. Episode editor `/admin/episodes`
Three-column desktop form: metadata + rich text / media preview / publish checklist. Required: headline, disclosure, provider tag, primary episode poster alt, at least one verified related event or explicit editorial-only label. Optional video channels, transcript, scheduled time, campaign day. Save draft -> preview -> validate -> publish. Scheduling uses stored UTC with human AWST preview. Clear warnings for missing social URL or stale related snapshot; don't publish financial claims newer than verification timestamp.

### E. Media library `/admin/media`
Drag/drop upload only after short-lived, single-object server-authorized R2 URL; validate MIME magic bytes, dimensions, byte size, virus screening as appropriate, immutable object keys, EXIF stripping and alt text. Serve via controlled public origin/CDN. Library grid filters by challenge and episode; safely reuses shared assets. Delete prevents removal while referenced unless soft-deprecating; asset listing shows usage count. No user uploads in MVP.

### F. Audit `/admin/audit`
Search actor, object, action, date. Entries contain before/after or diff, request ID, timestamp, change reason and original evidence pointers. Read-only to operator, retention policy documented. Show session/auth events separately from editorial audit.

### Admin mobile
Read-only monitoring and simple approve/reject support on phone; finance corrections and long-form editor may require desktop for accuracy. Every action stays keyboard and screen-reader accessible.

## 13. End-to-end user journeys and acceptance tests
### Journey 1: X viral mention → proof
User taps a tagged provider post -> specific challenge canonical page loads quickly -> sees net P&L and confidence label -> opens source transaction -> returns -> compares standings -> shares URL. **Acceptance:** financial and evidence labels visible above or close to fold; no login/wallet prompt; proof link works.

### Journey 2: TikTok clip → follow series
User visits linked homepage -> sees what 10 × $10 means -> watches 1 episode -> follows related challenge -> taps subscribe/follow X link. **Acceptance:** meaningful content in 5 seconds; CLS stable; video doesn't autoplay with sound.

### Journey 3: Existing viewer checks outcome
Visitor opens `/leaderboard` -> sees changed rank with real as-of timestamp -> selects 7D (if available) -> opens top and bottom results -> reads fees. **Acceptance:** zero-sum/negative results displayed correctly; stale/estimated states obvious.

### Journey 4: Operator imports trades
Cron ingests on-chain event -> deduplication -> admin alert -> review and attach transaction -> recalc position -> public snapshot -> metadata and summary updated. **Acceptance:** replay causes no duplicate balances; public figure consistent with proof event.

### Journey 5: Editor publishes recap
Operator uploads thumbnail -> drafts recap -> links challenge pages and X/TikTok/YouTube content -> previews mobile/social cards -> publishes -> canonical links open and metadata is fresh. **Acceptance:** no unsupported performance claim if data stale; external cards correct.

### Journey 6: Provider feed fails
Adapter times out -> mark source unavailable and preserve last valid snapshot -> admin receives alert -> visitor sees `Updated X ago` and source limitation, not a fabricated live value. **Acceptance:** homepage remains responsive; missing provider doesn't crash totals; totals show coverage limitations.

## 14. Component library specification
| Component | Variants and required behavior |
|---|---|
| BrandHeader | Desktop nav, mobile menu; logo, campaign status; skip link |
| PrimaryButton | primary/secondary/quiet/danger; hover, focus, pending, disabled |
| KPIBlock | value, unit, delta, precision, confidence, as-of, info popover |
| ChallengeCard | provider, strategy, value, ROI, risk, freshness, link, sparkline |
| RankingRow | rank, name, amount, change, confidence, accessible action |
| Money | sign, fiat code, precision, pending/unknown, tooltip |
| SourceBadge | verified/API/manual/estimated, explanatory tooltip |
| UpdateBadge | current/stale/failed/partial, last-success timestamp |
| PortfolioChart | keyboard data navigation, accessible table, missing gap handling |
| TimeRangeControl | only supported ranges, explicit disabled states |
| TransactionTable | filter/sort/page; row expand for audit/proof; download |
| EpisodeCard | responsive 16:9 poster, duration, platform, publish date |
| DisclosureNote | short risk copy, methodology/deep link, not dismiss-only |
| EmptyState | context + resolution, no false zero values |
| AlertBanner | error/warning/info, readable, actionable |
| MediaUploader | progress, constraints, alt-text, retry and cancel |
| ConfirmationDialog | clear irreversible action and typed confirmation when necessary |
| Toast | noncritical operation result, accessible live region |
| PageShell | standard width, section space, breadcrumbs, metadata |

Define component props with TypeScript from shared contracts; design Storybook or equivalent states for loading/error/empty/verified/estimated. Prohibit uncaught `NaN`, `undefined`, or impossible negative principal in the UI.

## 15. Charts and data visualisation semantics
Default portfolio plot: cumulative current *net liquidation estimate* in USD, starting at $100, discrete dots at snapshots, baseline horizontal line at $100. Dotted or gap style for interpolated/unavailable segments, legend for coverage percentage. Secondary optional benchmark is cash, not SOL performance, unless baseline method is explicit. One chart at a time on mobile; for provider detail choose value, P&L, fee accumulation or separate SOL comparison. Tooltips display date/time, actual measured amount, source, freshness and whether valuation is estimated. Use accessible tabular fallback with same figures.

UI valuation precision: show 2 decimals for total USD money where appropriate; tiny yields can use 4–6 decimals in detail, but not misrepresent a sub-cent result as `$0.00 earned` without context. ROI display to 2 decimals, negative zero normalised to zero, thousands grouped locale `en-AU` and currency clearly `USD`. Times default `Australia/Perth` (AWST), switchable UTC via preference; API timestamps remain RFC 3339 UTC.

## 16. Interaction states and error copy
- Initial campaign: `The challenge has not started. The first results will appear after the opening positions are verified.`
- No entries in filter: `No strategies match these filters. Clear filters.`
- Unpriced position: `Current value unavailable. Last confirmed position: [date].` Never imply zero.
- Unverified number: `Based on a provider statement; awaiting independent reconciliation.`
- Provider offline: `This venue's data has not updated since [timestamp]. We are showing the last verified value.`
- Unsupported off-chain result: `Evidence attached; automatic verification not available.`
- Confirmed wiped position: `Position closed with a total loss of the $10 allocation.`
- Network error: `We couldn't load the latest results. Retry or view the last cached summary.`
- Embeds blocked: `Open video on [platform]` with transcript where available.
- Challenge cancellation: public page remains with status, explanation and frozen history.

## 17. SEO, previews and social distribution
Every public route gets unique document title, meta description, canonical URL, social preview card, clean URL and schema.org where justified. Dynamic challenge and episode pages must generate distinct OG/title content at request/build time; **do not rely on a JS-only SPA to update OG tags for X crawlers**. Preview image template: provider badge, campaign label, time-framed P&L, verification timestamp, visually clear `Data as of` and no sensational fake numbers. Cache preview images using versioned keys after verified snapshot publication. Generate static preview for historical episodes; live leaderboard preview may update periodically, not on every tick.

Default sharing: X intent/share links with prefilled neutral, factual titles; no automated mass mention/tagging. Provider handles entered in admin with verified official profiles and link preview. UTM convention `source=[x|tiktok|youtube]&medium=social&campaign=defi100_2026&content=[episode_id]`. Avoid public follower-count or view-count claims until sourced through permitted APIs/records.

## 18. Performance, accessibility, security and privacy UX
### Performance budgets
Target LCP <2.5s on representative mobile, CLS <0.1, INP <200ms. Server/prerendered meaningful HTML for entry routes, lazy media and charts below fold, compressed responsive thumbnails, clear skeleton bounds, client cache with ETag/stale-while-revalidate, defer marketing analytics. Public pages degrade gracefully without JS where feasible. R2 asset URLs must be cacheable and image sizes constrained.

### Accessibility checklist
Keyboard navigation and visible focus; skip to content; semantic headings/tables; 4.5:1 text contrast where applicable; 44px touch targets as default; chart data tables and narrations; status not color-only; reduced motion; captions/transcripts; form error labels and focus to first error; no auto-refresh screen-reader spam; tested at 200% zoom and 320px widths.

### Trust and privacy
No login required for viewers and no forced cookies for basic site function. Analytics privacy notice; avoid invasive fingerprints. Public wallet addresses only when expressly intended; warnings if wallet doxxing could link other holdings. Never surface private account identifiers, session tokens, presigned URLs after expiry or EXIF location. Admin sign-in strong MFA; session expiry and safe `Are you sure?` for accounting changes. Explicit sponsorship/affiliate disclosures at page and post level if applicable.

## 19. Content voice, editorial rules and copy examples
Brand voice: curious, candid, technical enough to be credible, entertaining without hype, self-deprecating about losses, friendly to provider teams but independently critical. Say `Net return after fees` not `Guaranteed profit`; `Estimated exit value` rather than `Cash I can withdraw` unless genuinely exitable; `Last verified` not `Live` when delayed; `I tested` rather than `You should buy`.

Example homepage copy:
> Ten DeFi tools. Ten dollars each. Thirty days. Every trade, fee and loss is public. Which strategy actually comes out ahead?

Example detail outcome:
> Started with $10.00. Estimated exit value is $8.46 after recognised costs. That is a $1.54 loss. These figures reflect the latest verified position and an estimated exit trade.

Example weekly recap:
> Week 2: Two strategies are green, six are red, and two need reconciliation. Here's what the ledger actually shows.

## 20. Analytics instrumentation map
| Event | Trigger | Properties (minimal and non-PII) |
|---|---|---|
| `landing_view` | First meaningful view | path, source campaign, device class |
| `leaderboard_sort` | Changes comparison sort | metric, timeframe |
| `challenge_open` | Opens strategy detail | slug, entry surface |
| `proof_open` | Expands a transaction | challenge slug, proof type |
| `methodology_open` | Reads definitions | referral section |
| `episode_open` | Opens episode detail | episode slug, protocol IDs |
| `video_outbound` | Taps video platform | platform, episode |
| `provider_outbound` | Taps official provider | protocol slug |
| `share_click` | Shares/copies link | page type, method |
| `error_view` | Sees data failure | error class, route |
| `admin_publish` | Publishes update | type, audit event ID, no PII |

Respect Do Not Track / consent choice as required; analytics events should not store wallet keys, exact IPs, or financial account credentials. Maintain a dashboard for per-platform engagement, top referring episodes, CTR and returning visitors without implying causation from correlation.

## 21. Visual QA checklist / device matrix
- iPhone SE equivalent 375px / iPhone modern 390–430px, Android 360px, small 320px viewport, iPad/tablet, laptop 1366px, wide monitor 1920px.
- Safari iOS, Chrome Android, Chrome/Edge desktop, Firefox desktop, Safari macOS where available.
- Mobile menu, overflow tables, badge wrapping, long provider names, signed and zero money amounts, decimals <0.01, positive/negative/zero, stale/unknown/error, fully closed positions, extra-long titles.
- Keyboard-only and NVDA/VoiceOver spot tests.
- Low-bandwidth offline/timeout scenario; browser back between video and challenge.
- Social preview checks for homepage, two strategy slugs, and an episode on X/Discord and other relevant unfurl tools.

## 22. Design-to-development handoff assets
Create in Figma or equivalent: design tokens/components, mobile and desktop frames for every public route, all critical empty/error/verified/stale states, admin desktop layouts, responsive specs, annotated focus/keyboard behavior, exportable SVG logo and icons, OG card templates, motion guidelines, copy inventory, and contract mapping (`KPIBlock.currentValue -> ChallengeSummary.currentValueUsd`). Preserve accessible text strings outside raster artwork.

### Route-specific design delivery checklist
1. Home (mobile/desktop, before launch/active/complete).
2. Challenge index + leaderboard (all filters, mobile and desktop).
3. Challenge detail (spot, perpetual long/short, LP, unpriced, liquidated).
4. Episode index and episode detail (all media types; no-embed fallback).
5. Methodology + risk + status + about/legal.
6. Admin operations + transactions/reconciliation + challenge editing + episode editor + media management + audit.
7. OG templates, video thumbnail template, shareable leaderboard-card template.

## 23. Prioritised delivery plan and UX acceptance gates
**D0 — Foundation:** approve content language, tokens, navigation, campaign definition, finance display semantics, mobile shell. Acceptance: component docs + homepage and detail wireframes agreed.

**D1 — Public MVP:** homepage, leaderboard, challenge pages, proof drawer, methodology, empty/error/loading states. Acceptance: accessible 320px experience, correct financial display, no invalid `live` labels.

**D2 — Editorial MVP:** episodes, media and social integrations, share metadata/prerender. Acceptance: X link reliably unfurls correct challenge image and up-to-date stable metadata.

**D3 — Admin MVP:** finance reconciliation, provider page editing, posting pipeline, audit. Acceptance: human can complete Day 1 workflow and trace public total to exact events.

**D4 — Polish:** advanced compare, visual QA, performance, short-form optimizations, privacy and resilience. Acceptance: release checklist passes on mobile, core browser matrix and outage simulations.

## 24. Decisions to finalise before implementation
- Brand marks and final color/font licensing choices (amber/charcoal is proposed).
- Final ten permitted providers, strategies, wallet disclosure policies and Australian accessibility.
- Campaign start/end, market close and timezone policy, snapshot intervals.
- Whether audience should have read-only `follow challenge` feature later (out of MVP).
- Need for privacy-conscious email signup vs external social-only follows.
- Which video embeds are allowed and how to handle platform API/terms.
- Human review requirements for publication and corrections.

## 25. Reusable implementation prompt for design/build agents
> Build Belac.fun as a mobile-first, dark, editorial transparency dashboard for a 30-day $100 / 10-strategy DeFi experiment. Follow `architecture.md` as the financial and backend source of truth and this `uiux_design.md` for routes, interactions, breakpoints, token semantics and accessible states. Build with React, Vite, TypeScript, Cloudflare Pages; connect to a Railway Node Fastify API with shared Zod contracts. **Do not create trade execution, wallet-connect, staking or custodial flows.** Never present unverified or stale numbers as live. Implement homepage, leaderboard, detailed provider pages, proof and fee panels, episodes, methodology and protected admin. Test data-correctness, responsive behavior, social unfurls, loading and errors before release.

**Summary:** Belac.fun should be equally good at telling a story and proving a number. Proof creates credibility, recurring episodes create curiosity, and the leaderboard creates the habit of coming back.
