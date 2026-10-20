# Risk register

**Progress on 20 October 2026:** R3 is mitigated in `packages/finance` and FIN-02. R4 is mitigated for `belac_app` in DB-05 and DB-07. R2 is mitigated for the env parser, the demo seed, and the demo campaign summary. The other risks are unchanged.

| ID | Risk | Impact | Mitigation | Owner |
|---|---|---|---|---|
| R1 | Ten providers and Australia availability unknown | Publishing a venue could be unlawful or impossible to verify | No real provider publish until operator signs discovery note. Grade C manual path always works | Operator |
| R2 | Fake sample numbers shipped as real P&L | Destroys trust | `isIllustrative` flag; production boot guard; no mock data in prod UI | Engineering |
| R3 | Float arithmetic or double counting collateral and notional | Wrong public returns | `packages/finance` only; NUMERIC; fixture tests for architecture §8 and §16 cases | Engineering |
| R4 | Silent ledger edits | Unaudi table history | Append-only events; reversals; DB privileges: app role cannot UPDATE ledger amounts | Engineering |
| R5 | Railway cron skip / 5 min floor | Stale data shown as live | ADR-005 labels; job heartbeats; UI SLA | Engineering |
| R6 | Admin auth delayed | No safe way to enter real events | Build manual API behind auth interface; do not enable a passwordless production admin | Operator on ADR-004 |
| R7 | SPA OG tags fail on X | Social links look empty | ADR-003 prerender/Pages Function before calling social launch done | Operator on ADR-003 |
| R8 | Public RPC rate limits / wrong wallet activity | Missing or unrelated transactions ingested | Watermarks, pagination caps, operator attribution review, never assume full CEX history | Engineering |
| R9 | Paid services enabled early | Unapproved spend | No Railway, R2, Sentry, price vendor, or Postiz until approval | PM |
| R10 | Price source disagreement | Two marks, one UI | Primary/fallback policy in ADR-008; show source name; do not average silently | Operator |
| R11 | Reorg or late fill | Historical chart changes without explanation | Correction events; snapshot calc_version; public correction note | Engineering |
| R12 | Wallet address doxxing | Links operator to other funds | UX warning; dedicated wallets; visibility flag on accounts | Operator |
| R13 | XSS via markdown or embeds | Admin compromise or visitor harm | Sanitize markdown; allowlisted embed hosts; CSP | Engineering |
| R14 | Accessibility failure on charts | WCAG miss | Table fallback mandatory; color is not the only P&L signal | Engineering |
| R15 | Domain/DNS not controlled by operator | Cannot launch on belac.fun | Confirm DNS before Phase 8 | Operator |

## Assumptions (not silent product inventions)

1. Daily close **16:00 UTC** equals calendar midnight in Australia/Perth. Awaiting ADR-005 approval.
2. Freshness SLA **15 minutes** for automated marks and **60 minutes** for manual sources.
3. Unknown valuations are omitted from campaign equity and counted in `positionsCurrent/positionsTotal`, never coerced to zero.
4. Tailwind and `decimal.js` are implementation details inside the approved stack.
5. Local Postgres via Docker Compose is allowed; cloud databases are not created in this plan’s execution until approved.
6. First admin role model is three roles, one human operator at launch.
7. Illustrative seed campaign slug `demo` is forbidden in production.
8. Public CSV and newsletter stay P1/P2 (ADR-011).
