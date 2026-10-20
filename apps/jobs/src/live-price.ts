export type PriceFetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<{ priceUsd?: string }> }>;

export async function fetchLivePrice(baseUrl: string | undefined, assetId: string, get: PriceFetch): Promise<string | null> {
  if (!baseUrl) {
    return null;
  }
  const response = await get(`${baseUrl.replace(/\/$/, "")}/prices/${encodeURIComponent(assetId)}`);
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  return typeof body.priceUsd === "string" ? body.priceUsd : null;
}
