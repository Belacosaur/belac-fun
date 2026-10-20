export type Coverage = { valued: number; total: number };

export type CampaignSummary = {
  slug: string;
  name: string;
  state: string;
  equityUsd: string | null;
  netPnlUsd?: string | null;
  coverage: Coverage;
  isIllustrative: boolean;
};

export type LeaderboardRow = {
  rank: number;
  slug: string;
  state: string;
  providerName: string;
  allocationUsd: string;
  equityUsd: string | null;
  netPnlUsd: string | null;
  returnPct: string | null;
  quality: string;
  isIllustrative: boolean;
  asOf: string;
};

export type ChallengeDetail = {
  slug: string;
  provider: { slug: string; name: string };
  state: string;
  allocationUsd: string;
  equityUsd: string | null;
  netPnlUsd: string | null;
  returnPct: string | null;
  quality: string;
  isIllustrative: boolean;
  asOf: string;
};

export type TimelinePoint = {
  at: string;
  equityUsd: string | null;
  coverage: Coverage;
};

export type ContentCard = {
  slug: string;
  title: string;
  summary?: string | null;
  body_md?: string | null;
};

export type SiteStatus = {
  jobs: Array<{ name: string; freshness: string }>;
};

export type Client = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
};

async function readData<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }
  const body = (await response.json()) as { data: T };
  return body.data;
}

export function createClient(baseUrl = ""): Client {
  return {
    async get<T>(path: string): Promise<T> {
      return readData<T>(await fetch(`${baseUrl}${path}`));
    },
    async post<T>(path: string, body: unknown): Promise<T> {
      return readData<T>(
        await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    },
  };
}
