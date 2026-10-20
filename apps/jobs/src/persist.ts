import { Decimal } from "decimal.js";
import { netPnlUsd, returnPct } from "@belac/finance";
import type pg from "pg";
import { reconciliationGap } from "./reconcile.js";

export async function writeSnapshots(pool: pg.Pool) {
  const challenges = await pool.query<{ id: string; allocation_usd: string }>(
    `select id, allocation_usd from challenges`,
  );
  for (const challenge of challenges.rows) {
    const sums = await pool.query<{ equity: string }>(
      `select coalesce(sum(le.value_usd), 0)::text as equity
       from ledger_entries le
       join ledger_events e on e.id = le.event_id
       where e.challenge_id = $1`,
      [challenge.id],
    );
    const equity = new Decimal(sums.rows[0]?.equity ?? "0").toString();
    const pnl = netPnlUsd({
      endingEquityUsd: equity,
      startingEquityUsd: String(challenge.allocation_usd),
      netExternalContributionsUsd: "0",
    });
    const pct = new Decimal(String(challenge.allocation_usd)).isZero()
      ? "0"
      : returnPct({ netPnlUsd: pnl, startingEquityUsd: String(challenge.allocation_usd) });
    await pool.query(
      `insert into valuation_snapshots (challenge_id, observed_at, equity_usd, pnl_usd, pnl_pct, quality, calc_version)
       values ($1, date_trunc('minute', now()), $2, $3, $4, 'manual_evidence', 'v1')
       on conflict (challenge_id, observed_at, calc_version) do nothing`,
      [challenge.id, equity, pnl, pct],
    );
  }
}

export async function writeReconciliation(pool: pg.Pool, challengeId: string, reportedUsd: string, replayUsd: string) {
  const gap = reconciliationGap(reportedUsd, replayUsd);
  if (!gap.openIssue) {
    return { opened: false };
  }
  const existing = await pool.query(
    `select id from reconciliation_issues where challenge_id = $1 and kind = 'disagreement' and state = 'open' limit 1`,
    [challengeId],
  );
  if (existing.rows.length > 0) {
    return { opened: false };
  }
  await pool.query(
    `insert into reconciliation_issues (challenge_id, severity, kind, state, opened_at, detail_jsonb)
     values ($1, 'high', 'disagreement', 'open', now(), $2::jsonb)`,
    [challengeId, JSON.stringify({ gap: gap.gap })],
  );
  return { opened: true };
}

export async function freezeLeaderboard(pool: pg.Pool) {
  await pool.query(
    `insert into leaderboard_revisions (campaign_id, week_start, payload)
     select id, date_trunc('week', now())::date, jsonb_build_object('calcVersion', 'v1')
     from campaigns
     on conflict (campaign_id, week_start) do nothing`,
  );
}
