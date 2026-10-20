import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  assets,
  campaigns,
  challenges,
  ledgerEntries,
  ledgerEvents,
  providers,
  sourceRecords,
  valuationSnapshots,
} from "./schema.js";

const observedAt = "2026-10-20T00:00:00.000Z";

/**
 * Demo rows are illustrative. The stored campaigns.is_illustrative flag is true only for this seed.
 */
export async function seed(db: NodePgDatabase) {
  await db
    .insert(campaigns)
    .values({
      slug: "demo",
      name: "Demo campaign",
      startsAt: observedAt,
      endsAt: "2026-11-19T00:00:00.000Z",
      state: "draft",
      policyVersion: "1",
      baseCurrency: "USD",
      isIllustrative: true,
    })
    .onConflictDoUpdate({
      target: campaigns.slug,
      set: { isIllustrative: true },
    });

  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.slug, "demo"));
  if (!campaign) {
    throw new Error("demo campaign missing after seed");
  }

  await db
    .insert(providers)
    .values([
      {
        slug: "demo-provider-a",
        name: "Demo provider A",
        homepageUrl: "https://example.com/a",
        status: "unreviewed",
      },
      {
        slug: "demo-provider-b",
        name: "Demo provider B",
        homepageUrl: "https://example.com/b",
        status: "unreviewed",
      },
    ])
    .onConflictDoNothing({ target: providers.slug });

  const providerRows = await db.select().from(providers);
  const providerA = providerRows.find((row) => row.slug === "demo-provider-a");
  const providerB = providerRows.find((row) => row.slug === "demo-provider-b");
  if (!providerA || !providerB) {
    throw new Error("demo providers missing after seed");
  }

  await db
    .insert(challenges)
    .values([
      {
        campaignId: campaign.id,
        providerId: providerA.id,
        slug: "demo-a",
        strategyType: "demo",
        state: "planned",
        allocationUsd: "10.00000000",
        beginsAt: observedAt,
        endsAt: "2026-11-19T00:00:00.000Z",
        rankOrder: 1,
      },
      {
        campaignId: campaign.id,
        providerId: providerB.id,
        slug: "demo-b",
        strategyType: "demo",
        state: "planned",
        allocationUsd: "10.00000000",
        beginsAt: observedAt,
        endsAt: "2026-11-19T00:00:00.000Z",
        rankOrder: 2,
      },
    ])
    .onConflictDoNothing({ target: challenges.slug });

  const [challenge] = await db.select().from(challenges).where(eq(challenges.slug, "demo-a"));
  if (!challenge) {
    throw new Error("demo challenge missing after seed");
  }

  await db
    .insert(assets)
    .values({
      chain: "solana",
      mintOrSymbol: "USDC",
      symbol: "USDC",
      decimals: 6,
      pricingKey: "usd-coin",
    })
    .onConflictDoNothing({ target: [assets.chain, assets.mintOrSymbol] });

  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.mintOrSymbol, "USDC"));
  if (!asset) {
    throw new Error("demo asset missing after seed");
  }

  await db
    .insert(sourceRecords)
    .values({
      challengeId: challenge.id,
      sourceType: "manual",
      externalId: "demo-deposit",
      status: "unverified",
      observedAt,
      fetchedAt: observedAt,
      payloadHash: "demo",
    })
    .onConflictDoNothing({
      target: [sourceRecords.sourceType, sourceRecords.externalId],
    });

  const [source] = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.externalId, "demo-deposit"));
  if (!source) {
    throw new Error("demo source missing after seed");
  }

  await db
    .insert(ledgerEvents)
    .values({
      challengeId: challenge.id,
      sourceId: source.id,
      eventType: "deposit",
      effectiveAt: observedAt,
      recordedAt: observedAt,
      externalKey: "demo-deposit",
      status: "recorded",
    })
    .onConflictDoNothing({
      target: [ledgerEvents.challengeId, ledgerEvents.externalKey],
    });

  const [event] = await db
    .select()
    .from(ledgerEvents)
    .where(eq(ledgerEvents.externalKey, "demo-deposit"));
  if (!event) {
    throw new Error("demo deposit missing after seed");
  }

  const entries = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.eventId, event.id));
  if (entries.length === 0) {
    await db.insert(ledgerEntries).values({
      eventId: event.id,
      assetId: asset.id,
      signedAmount: "10.000000000000000000",
      valueUsd: "10.0000000000",
      costUsd: "10.0000000000",
      legType: "inflow",
    });
  }

  await db
    .insert(valuationSnapshots)
    .values({
      challengeId: challenge.id,
      observedAt,
      equityUsd: "10.0000000000",
      pnlUsd: "0.0000000000",
      pnlPct: "0.0000000000",
      quality: "unverified",
      calcVersion: "demo-1",
    })
    .onConflictDoNothing({
      target: [
        valuationSnapshots.challengeId,
        valuationSnapshots.observedAt,
        valuationSnapshots.calcVersion,
      ],
    });
}
