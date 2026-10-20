import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  createClient,
  type CampaignSummary,
  type ChallengeDetail,
  type Client,
  type ContentCard,
  type LeaderboardRow,
  type SiteStatus,
  type TimelinePoint,
} from "./api";
import { EquityChart } from "./Chart";
import { copy } from "./copy";
import { Money, SourceBadge } from "./Money";

const started = new Set(["active", "frozen", "closed"]);

export function useGet<T>(client: Client, path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!path) {
      return;
    }
    let cancelled = false;
    setError(false);
    client
      .get<T>(path)
      .then((value) => {
        if (!cancelled) {
          setData(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, path, attempt]);
  return { data, error, retry: () => setAttempt((value) => value + 1) };
}

export function HomePage({ client }: { client: Client }) {
  const summary = useGet<CampaignSummary>(client, "/v1/campaigns/current");
  const board = useGet<LeaderboardRow[]>(client, summary.data ? `/v1/campaigns/${summary.data.slug}/leaderboard?metric=return_pct` : null);
  const timeline = useGet<TimelinePoint[]>(client, summary.data ? `/v1/campaigns/${summary.data.slug}/timeline?granularity=day` : null);
  useEffect(() => {
    document.title = "Belac.fun — the $100 experiment";
  }, []);
  if (summary.error) {
    return (
      <section>
        <h1>Home</h1>
        <p>{copy.network}</p>
        <button type="button" onClick={summary.retry}>
          Retry
        </button>
      </section>
    );
  }
  if (!summary.data) {
    return (
      <section>
        <h1>Home</h1>
        <p>Loading results</p>
      </section>
    );
  }
  const liveCampaign = started.has(summary.data.state);
  return (
    <section>
      <h1>Home</h1>
      {summary.data.isIllustrative ? <p role="status">{copy.illustrative}</p> : null}
      <p>{liveCampaign ? "LIVE EXPERIMENT" : "CAMPAIGN NOT ACTIVE"}</p>
      {!liveCampaign ? <p>{copy.notStarted}</p> : null}
      <p>
        Portfolio value · USD <Money value={summary.data.equityUsd} />
      </p>
      <p>
        Coverage {summary.data.coverage.valued}/{summary.data.coverage.total}
      </p>
      <Link to="/leaderboard">Explore the leaderboard</Link>
      <Link to="/methodology">How we calculate results</Link>
      <EquityChart points={timeline.data ?? []} />
      <ol>
        {(board.data ?? []).map((row) => (
          <li key={row.slug}>
            <span>{row.rank}</span> {row.providerName} <Money value={row.netPnlUsd} />
            <SourceBadge grade={row.quality} />
            <Link to={`/challenge/${row.slug}`}>View {row.providerName}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LeaderboardPage({ client, title = "Leaderboard" }: { client: Client; title?: string }) {
  const [metric, setMetric] = useState<"return_pct" | "pnl_usd">("return_pct");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const summary = useGet<CampaignSummary>(client, "/v1/campaigns/current");
  const board = useGet<LeaderboardRow[]>(
    client,
    summary.data ? `/v1/campaigns/${summary.data.slug}/leaderboard?metric=${metric}` : null,
  );
  const rows = (board.data ?? []).filter((row) => {
    const name = row.providerName.toLowerCase().includes(query.toLowerCase());
    const statusOk = status === "all" || row.state === status;
    const sourceOk = source === "all" || row.quality === source;
    return name && statusOk && sourceOk;
  });
  return (
    <section>
      <h1>{title}</h1>
      <p>Risk and time in market differ.</p>
      <button type="button" disabled>
        24H
      </button>
      <button type="button" disabled>
        7D
      </button>
      <p>24H and 7D windows are not available yet.</p>
      <button type="button" onClick={() => setMetric("return_pct")}>
        Sort by return
      </button>
      <button type="button" onClick={() => setMetric("pnl_usd")}>
        Sort by P&L
      </button>
      <label>
        Search protocols
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All</option>
          <option value="planned">Planned</option>
          <option value="live">Live</option>
          <option value="paused">Paused</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      <label>
        Source
        <select value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">All</option>
          <option value="unverified">Unverified</option>
          <option value="manual_evidence">Manual</option>
        </select>
      </label>
      {query && rows.length === 0 ? <p>{copy.noFilterMatch}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Provider</th>
            <th>Net P&L</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.slug}>
              <td>{row.rank}</td>
              <td>
                <Link to={`/challenge/${row.slug}`}>{row.providerName}</Link>
              </td>
              <td>
                <Money value={row.netPnlUsd} />
              </td>
              <td>
                <SourceBadge grade={row.quality} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ChallengePage({ client }: { client: Client }) {
  const { slug = "" } = useParams();
  const campaign = useGet<CampaignSummary>(client, "/v1/campaigns/current");
  const detail = useGet<ChallengeDetail>(client, `/v1/challenges/${slug}`);
  const timeline = useGet<TimelinePoint[]>(
    client,
    campaign.data ? `/v1/campaigns/${campaign.data.slug}/timeline?granularity=day` : null,
  );
  const transactions = useGet<{ items: Array<{ id: string; eventType: string; valueUsd: string | null }> }>(
    client,
    `/v1/challenges/${slug}/transactions`,
  );
  const sources = useGet<Array<{ source_type: string; status: string }>>(client, `/v1/challenges/${slug}/sources`);
  useEffect(() => {
    if (detail.data) {
      document.title = `${detail.data.provider.name} — Belac.fun`;
    }
  }, [detail.data]);
  if (detail.error) {
    return (
      <section>
        <h1>Challenge</h1>
        <p>{copy.network}</p>
      </section>
    );
  }
  if (!detail.data) {
    return (
      <section>
        <h1>Challenge</h1>
        <p>Loading results</p>
      </section>
    );
  }
  return (
    <section>
      <h1>Challenge</h1>
      {detail.data.isIllustrative ? <p role="status">{copy.illustrative}</p> : null}
      <p>Provider used for experiment</p>
      <p>{detail.data.provider.name}</p>
      <a href="#overview">Overview</a>
      <a href="#performance">Performance</a>
      <a href="#transactions">Transactions</a>
      <a href="#updates">Updates</a>
      <a href="#rules">Rules</a>
      <div id="performance">
        {detail.data.equityUsd === null ? <p>{copy.unpriced}</p> : <Money value={detail.data.equityUsd} />}
        <SourceBadge grade={detail.data.quality} />
      </div>
      <EquityChart points={timeline.data ?? []} />
      <h2>Proof</h2>
      <ul>
        {(transactions.data?.items ?? []).map((item) => (
          <li key={item.id}>
            {item.eventType} <Money value={item.valueUsd} />
          </li>
        ))}
      </ul>
      <h2>Fees</h2>
      <ul>
        {(Array.isArray(sources.data) ? sources.data : []).map((item) => (
          <li key={`${item.source_type}-${item.status}`}>
            {item.source_type} {item.status}
          </li>
        ))}
      </ul>
      <ShareButton />
    </section>
  );
}

export function EpisodesPage({ client }: { client: Client }) {
  const list = useGet<ContentCard[]>(client, "/v1/content");
  return (
    <section>
      <h1>Episodes</h1>
      {(list.data ?? []).map((item) => (
        <article key={item.slug}>
          <h2>{item.title}</h2>
          <Link to={`/episodes/${item.slug}`}>{item.title}</Link>
        </article>
      ))}
    </section>
  );
}

const embedHosts = new Set(["youtube.com", "youtube-nocookie.com", "www.tiktok.com", "x.com"]);

export function EpisodePage({ client }: { client: Client }) {
  const { slug = "" } = useParams();
  const item = useGet<ContentCard & { embedUrl?: string | null }>(client, `/v1/content/${slug}`);
  const [play, setPlay] = useState(false);
  const embed = item.data?.embedUrl ?? null;
  let host = "";
  try {
    host = embed ? new URL(embed).hostname : "";
  } catch {
    host = "";
  }
  const allowed = embedHosts.has(host);
  return (
    <section>
      <h1>Episode</h1>
      <button type="button" onClick={() => setPlay(true)}>
        Play
      </button>
      {play && allowed ? <iframe title={item.data?.title ?? "Episode"} src={embed ?? undefined} /> : null}
      {play && embed && !allowed ? <p>{copy.embedBlocked}</p> : null}
      {item.data?.body_md ? <p>{item.data.body_md}</p> : null}
      <ShareButton />
    </section>
  );
}

export function AdminOverview({ client }: { client: Client }) {
  const issues = useGet<Array<{ id: string; severity: string; state: string }>>(client, "/v1/admin/reconciliation");
  const jobs = useGet<SiteStatus>(client, "/v1/site/status");
  const open = (issues.data ?? []).filter((issue) => issue.state === "open");
  return (
    <section>
      <h2>Reconciliation queue</h2>
      {issues.error ? <p>{copy.network}</p> : null}
      {open.length === 0 ? <p>No open reconciliation issues.</p> : null}
      <ul>
        {open.map((issue) => (
          <li key={issue.id}>
            {issue.severity} {issue.state}
          </li>
        ))}
      </ul>
      <h2>Job queue</h2>
      <ul>
        {(jobs.data?.jobs ?? []).map((job) => (
          <li key={job.name}>
            {job.name} {job.freshness}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatusPage({ client }: { client: Client }) {
  const status = useGet<SiteStatus>(client, "/v1/site/status");
  return (
    <section>
      <h1>Status</h1>
      {status.error ? <p>{copy.network}</p> : null}
      <ul>
        {(status.data?.jobs ?? []).map((job) => (
          <li key={job.name}>
            {job.name} {job.freshness}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(window.location.href);
        setCopied(true);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export const defaultClient = createClient(import.meta.env.VITE_API_BASE_URL ?? "");
