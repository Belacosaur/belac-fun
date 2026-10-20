import { Decimal } from "decimal.js";
import type pg from "pg";

export const slaMinutes = 15;
export const disagreementUsd = "0.05";

export type Database = pg.Pool;

type Row = Record<string, unknown>;

async function rows<T extends Row>(db: Database, text: string, values: unknown[] = []) {
  const result = await db.query(text, values);
  return result.rows as T[];
}

export async function currentCampaign(db: Database) {
  const found = await rows(
    db,
    `select id, slug, name, state, starts_at, ends_at, is_illustrative from campaigns order by starts_at desc limit 1`,
  );
  return found[0] ?? null;
}

export async function campaignBySlug(db: Database, slug: string) {
  const found = await rows(
    db,
    `select id, slug, name, state, starts_at, ends_at, is_illustrative from campaigns where slug = $1`,
    [slug],
  );
  return found[0] ?? null;
}

export async function latestSnapshots(db: Database, campaignId: string) {
  return rows(
    db,
    `select distinct on (c.id) c.slug, c.state, p.name as provider_name,
            v.equity_usd, v.pnl_usd, v.pnl_pct, v.quality, v.observed_at, v.calc_version,
            c.allocation_usd
     from challenges c
     join providers p on p.id = c.provider_id
     left join valuation_snapshots v on v.challenge_id = c.id
     where c.campaign_id = $1
     order by c.id, v.observed_at desc nulls last`,
    [campaignId],
  );
}

export function moneyString(value: Decimal): string {
  return value.toFixed(Math.max(2, value.decimalPlaces()));
}

function decimalOrNull(value: unknown): Decimal | null {
  if (value == null) {
    return null;
  }
  return new Decimal(String(value));
}

export function rankRows(items: Row[], metric: "pnl_usd" | "return_pct"): Array<Row & { rank: number }> {
  const sorted = [...items].sort((left, right) => {
    const a = decimalOrNull(left[metric]);
    const b = decimalOrNull(right[metric]);
    if (a == null && b == null) {
      return 0;
    }
    if (a == null) {
      return 1;
    }
    if (b == null) {
      return -1;
    }
    return b.comparedTo(a);
  });
  let rank = 0;
  let previous: Decimal | null = null;
  return sorted.map((item, index) => {
    const value = decimalOrNull(item[metric]);
    if (value == null || previous == null || !value.equals(previous)) {
      rank = index + 1;
    }
    previous = value;
    return { ...item, rank };
  });
}

export function sumColumn(items: Row[], key: string): string | null {
  const valued = items.filter((item) => item[key] != null);
  if (valued.length === 0) {
    return null;
  }
  const total = valued.reduce((sum, item) => sum.plus(String(item[key])), new Decimal(0));
  return moneyString(total);
}

export function campaignEquity(items: Row[]) {
  const valued = items.filter((item) => item.equity_usd != null);
  return {
    equityUsd: sumColumn(items, "equity_usd"),
    coverage: { valued: valued.length, total: items.length },
  };
}

export async function challengeBySlug(db: Database, slug: string) {
  const found = await rows(
    db,
    `select c.id, c.slug, c.state, c.allocation_usd, c.strategy_type, p.slug as provider_slug, p.name as provider_name,
            camp.is_illustrative
     from challenges c
     join providers p on p.id = c.provider_id
     join campaigns camp on camp.id = c.campaign_id
     where c.slug = $1`,
    [slug],
  );
  const redirected = found[0]
    ? found
    : await rows(
        db,
        `select c.id, c.slug, c.state, c.allocation_usd, c.strategy_type, p.slug as provider_slug, p.name as provider_name,
                camp.is_illustrative
         from slug_redirects r
         join challenges c on c.slug = r.to_slug
         join campaigns camp on camp.id = c.campaign_id
         join providers p on p.id = c.provider_id
         where r.from_slug = $1`,
        [slug],
      );
  return redirected[0] ?? null;
}

export async function snapshots(db: Database, challengeId: string, from?: string, to?: string) {
  return rows(
    db,
    `select observed_at, equity_usd, pnl_usd, pnl_pct, quality, calc_version
     from valuation_snapshots
     where challenge_id = $1
       and ($2::timestamptz is null or observed_at >= $2::timestamptz)
       and ($3::timestamptz is null or observed_at <= $3::timestamptz)
     order by observed_at asc`,
    [challengeId, from ?? null, to ?? null],
  );
}

export async function transactions(db: Database, challengeId: string, cursor: string | undefined, pageSize: number) {
  const parts = cursor?.split("|");
  const found = await rows(
    db,
    `select e.id, e.event_type, e.effective_at, e.status, le.value_usd
     from ledger_events e
     left join ledger_entries le on le.event_id = e.id
     where e.challenge_id = $1
       and ($2::timestamptz is null or (e.effective_at, e.id) < ($2::timestamptz, $3::uuid))
     order by e.effective_at desc, e.id desc
     limit $4`,
    [challengeId, parts?.[0] ?? null, parts?.[1] ?? null, pageSize],
  );
  const last = found.at(-1);
  const nextCursor = last ? `${String(last.effective_at)}|${String(last.id)}` : null;
  return { rows: found, nextCursor };
}

export async function positions(db: Database, challengeId: string) {
  return rows(
    db,
    `select instrument_key, state, opened_at from positions where challenge_id = $1`,
    [challengeId],
  );
}

export async function sources(db: Database, challengeId: string) {
  return rows(
    db,
    `select source_type, external_id, external_url, status, observed_at from source_records where challenge_id = $1`,
    [challengeId],
  );
}

export async function contentList(db: Database) {
  return rows(
    db,
    `select slug, title, content_type, published_at from content_posts where status = 'published' order by published_at desc nulls last`,
  );
}

export async function contentBySlug(db: Database, slug: string) {
  const found = await rows(db, `select slug, title, body_md, content_type, published_at from content_posts where slug = $1`, [slug]);
  return found[0] ?? null;
}

export async function providerBySlug(db: Database, slug: string) {
  const found = await rows(db, `select slug, name, homepage_url, status from providers where slug = $1`, [slug]);
  return found[0] ?? null;
}

export async function latestJobs(db: Database) {
  return rows(
    db,
    `select distinct on (job_name) job_name, completed_at
     from job_runs
     order by job_name, completed_at desc nulls last`,
  );
}

function bucketStart(observedAt: string, granularity: "hour" | "day") {
  const date = new Date(observedAt);
  if (granularity === "hour") {
    date.setUTCMinutes(0, 0, 0);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

export async function campaignTimeline(
  db: Database,
  campaignId: string,
  granularity: "hour" | "day",
  from?: string,
  to?: string,
) {
  const snaps = await rows(
    db,
    `select c.id as challenge_id, v.equity_usd, v.observed_at
     from valuation_snapshots v
     join challenges c on c.id = v.challenge_id
     where c.campaign_id = $1
       and ($2::timestamptz is null or v.observed_at >= $2::timestamptz)
       and ($3::timestamptz is null or v.observed_at <= $3::timestamptz)
     order by v.observed_at asc`,
    [campaignId, from ?? null, to ?? null],
  );
  const latest = new Map<string, Map<string, unknown>>();
  for (const snap of snaps) {
    const at = bucketStart(String(snap.observed_at), granularity);
    const byChallenge = latest.get(at) ?? new Map<string, unknown>();
    byChallenge.set(String(snap.challenge_id), snap.equity_usd);
    latest.set(at, byChallenge);
  }
  return [...latest.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([at, byChallenge]) => {
      const equities = [...byChallenge.values()];
      const valued = equities.filter((value) => value != null).map((value) => String(value));
      const equity =
        valued.length === 0
          ? null
          : moneyString(valued.reduce((sum, value) => sum.plus(value), new Decimal(0)));
      return {
        at,
        equityUsd: equity,
        granularity,
        coverage: { valued: valued.length, total: equities.length },
      };
    });
}
