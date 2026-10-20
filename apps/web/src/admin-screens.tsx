import { useState } from "react";
import { Link } from "react-router";
import type { CampaignSummary, Client, ContentCard, LeaderboardRow } from "./api";
import { copy } from "./copy";
import { useGet } from "./pages";

const links = [
  ["Overview", "/admin/overview"],
  ["Challenges", "/admin/challenges"],
  ["Transactions", "/admin/transactions"],
  ["Prices", "/admin/prices"],
  ["Episodes", "/admin/episodes"],
  ["Media", "/admin/media"],
  ["Social", "/admin/social"],
  ["Audit", "/admin/audit"],
  ["Settings", "/admin/settings"],
] as const;

export function AdminNav() {
  return (
    <nav aria-label="Admin">
      {links.map(([label, href]) => (
        <Link key={href} to={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ChallengeAdmin({ client }: { client: Client }) {
  const summary = useGet<CampaignSummary>(client, "/v1/campaigns/current");
  const rows = useGet<LeaderboardRow[]>(client, summary.data ? `/v1/campaigns/${summary.data.slug}/leaderboard?metric=pnl_usd` : null);
  return (
    <table>
      <caption>{summary.data?.name ?? "Challenges"}</caption>
      <tbody>
        {(rows.data ?? []).map((row) => (
          <tr key={row.slug}>
            <td>{row.providerName}</td>
            <td>{row.state}</td>
            <td>{row.quality}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuditAdmin({ client }: { client: Client }) {
  const rows = useGet<Array<{ action: string; reason: string; created_at: string }>>(client, "/v1/admin/audit");
  if (rows.error) {
    return <p>{copy.network}</p>;
  }
  return (
    <ul>
      {(rows.data ?? []).map((row) => (
        <li key={`${row.action}-${row.created_at}`}>
          {row.action}: {row.reason}
        </li>
      ))}
    </ul>
  );
}

export function EpisodeAdmin({ client }: { client: Client }) {
  const rows = useGet<ContentCard[]>(client, "/v1/content");
  return (
    <ul>
      {(rows.data ?? []).map((row) => (
        <li key={row.slug}>{row.title}</li>
      ))}
    </ul>
  );
}

export function SettingsAdmin({ client }: { client: Client }) {
  const summary = useGet<CampaignSummary>(client, "/v1/campaigns/current");
  if (!summary.data) {
    return <p>Loading results</p>;
  }
  return (
    <dl>
      <dt>Campaign</dt>
      <dd>{summary.data.name}</dd>
      <dt>State</dt>
      <dd>{summary.data.state}</dd>
      <dt>Illustrative</dt>
      <dd>{summary.data.isIllustrative ? "yes" : "no"}</dd>
    </dl>
  );
}

export function PriceAdmin() {
  return <p>No price vendor is configured. Marks stay on the last stored snapshot until a price URL is added.</p>;
}

export function SocialAdmin({ client }: { client: Client }) {
  const [contentId, setContentId] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void client
          .post("/v1/admin/social/metrics", { contentId, url })
          .then(() => setMessage("Saved as manual."))
          .catch(() => setMessage(copy.network));
      }}
    >
      <label>
        Content id
        <input value={contentId} onChange={(event) => setContentId(event.target.value)} />
      </label>
      <label>
        Post URL
        <input value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <button type="submit">Save manual metric</button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}

export function PreviewForm({ client }: { client: Client }) {
  const [valueUsd, setValueUsd] = useState("1.00");
  const [result, setResult] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void client
          .post<{ nextEquityUsd: string }>("/v1/admin/ledger/preview", { currentEquityUsd: "10.00", valueUsd })
          .then((body) => setResult(body.nextEquityUsd))
          .catch(() => setResult(copy.network));
      }}
    >
      <label>
        Value USD
        <input name="valueUsd" value={valueUsd} onChange={(event) => setValueUsd(event.target.value)} />
      </label>
      <button type="submit">Preview</button>
      {result ? <p>Next equity {result}</p> : null}
    </form>
  );
}
