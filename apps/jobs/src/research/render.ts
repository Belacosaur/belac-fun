import type { ResearchReport } from "../../../../packages/contracts/src/research.js";

const safe = (s: string) => s.replace(/[\r\n|<>]/g, " ").replace(/\[/g, "(").replace(/\]/g, ")");
export function renderResearch(report: ResearchReport): string {
  const lines = ["# Belac.fun research dry run", "", `Run: ${report.runId} · Policy: ${report.policyVersion}`,
    `Completed: ${report.completedAt} · Review expires: ${report.reviewBy} · Status: ${report.status}`, "",
    "Execution: DISABLED. $100 strategy capital; $10 per station, including $10 reserved for Ript. Separate SOL fee/rent pool remains unpriced.", "",
    "This is a preliminary screener, not an entry recommendation or a proven trading strategy.", "",
    "| Station | Provider | Decision | Scanned | Shortlisted | Rejected/deferred |", "|---|---|---|---:|---:|---:|"];
  for (const s of report.stations) lines.push(`| ${s.id} | ${s.provider} | ${s.decision} | ${s.scanned} | ${s.shortlisted.length} | ${s.rejected.length} |`);
  for (const s of report.stations) {
    lines.push("", `## ${s.id}. ${s.provider} — ${s.method}`, "", `Decision: **${s.decision}**. Allocation $10.00. Existing-position comparison: unbound.`,
      `Ranking: ${s.rankingBasis}`, "");
    for (const gap of s.gaps) lines.push(`- Gap: ${gap}`);
    for (const c of s.shortlisted) {
      lines.push("", `### ${c.rank}. ${safe(c.label)}`, "", `Identity: \`${safe(c.id)}\`. Entry eligible: **NO**.`, "",
        "| Input | Observed value |", "|---|---|");
      for (const [k, v] of Object.entries(c.metrics)) lines.push(`| ${safe(k)} | ${v === null ? "unknown" : safe(String(v))} |`);
      lines.push("", ...c.reasons.map(r => `- Evidence: ${r}`), ...c.blockers.map(r => `- Blocker: ${r}`), "",
        `Entry rule: ${c.plan.entry}`, `Exit rule: ${c.plan.exit}`, `Horizon: ${c.plan.horizonDays} days. Benchmark: ${c.plan.benchmark}`, "",
        ...c.sourceIds.map(id => { const src = report.sources.find(s => s.id === id); return src ? `- Source: [${safe(id)}](${src.url}) — retrieved ${src.fetchedAt}; ${src.status}; SHA-256 ${src.sha256 ?? "unavailable"}` : `- Missing source: ${id}`; }));
    }
    if (s.rejected.length) {
      lines.push("", "### Rejected / outside shortlist", "", "| Candidate | Identity | Reason |", "|---|---|---|");
      for (const c of s.rejected) lines.push(`| ${safe(c.label)} | ${safe(c.id)} | ${safe(c.reasons.join("; "))} |`);
    }
  }
  lines.push("", "## Data collection", "", "| Source | Result | Retrieved |", "|---|---|---|");
  for (const s of report.sources) lines.push(`| [${safe(s.id)}](${s.url}) | ${s.status}${s.error ? `: ${s.error}` : ""} | ${s.fetchedAt} |`);
  lines.push("", "## Limits", "", ...report.warnings.map(w => `- ${w}`), "");
  return lines.join("\n");
}
