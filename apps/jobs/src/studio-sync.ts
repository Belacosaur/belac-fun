import { Decimal } from "decimal.js";
import { CHALLENGE } from "../../../packages/contracts/src/challenge.js";
import { MAINNET_GENESIS, readPumpPrograms, readSwapQuote } from "./platform-readers.js";
import { readActivePositions } from "./active-positions.js";
import { readMeteoraDamm } from "./meteora-damm.js";
import { readMeteoraPosition } from "./meteora-position.js";
import type { MeteoraReceipt } from "../../../packages/contracts/src/trades.js";
import {applyRecoveryTracking} from "./recovery-tracking.js";
import {applyStationEntryTracking} from "./entry-tracking.js";
import type {StationEntryReceipt} from "../../../packages/contracts/src/station-entries.js";
import { readKaminoDirect, readKaminoSupplyApy, KAMINO_CONFIRMED_ENTRY } from "./kamino-direct.js";
import type { Observation, PlatformBalance, StudioSnapshot, WalletBalance } from "../../../packages/contracts/src/studio.js";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid upstream object");
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid upstream array");
  return value;
}
function decimal(value: unknown): Decimal {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Missing numeric field");
  const result = new Decimal(value);
  if (!result.isFinite()) throw new Error("Invalid numeric field");
  return result;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid count");
  return value;
}

export async function observe<T>(work: () => Promise<T>, previous: Observation<T> | undefined, now: string): Promise<Observation<T>> {
  try {
    return { status: "ready", checkedAt: now, lastSuccessAt: now, data: await work(), message: "Read-only sync connected" };
  } catch {
    // Never expose RPC URLs, credentials, or arbitrary upstream bodies.
    return { status: "unavailable", checkedAt: now, lastSuccessAt: previous?.lastSuccessAt ?? null,
      data: previous?.data ?? null, message: "Source unavailable; retrying automatically. Displayed values are from the last successful sync." };
  }
}

export function normalizeWallet(lamports: unknown, accounts: unknown[], signatures: unknown[], slot = 0): WalletBalance {
  const sol = decimal(count(lamports)).div(1e9);
  const balances = new Map<string, Decimal>();
  for (const account of accounts) {
    const info = object(object(object(object(object(account).account).data).parsed).info);
    const amount = object(info.tokenAmount);
    if (typeof info.mint !== "string") throw new Error("Invalid mint");
    const digits = count(amount.decimals);
    if (digits > 255) throw new Error("Invalid decimals");
    const quantity = decimal(amount.amount).div(new Decimal(10).pow(digits));
    if (quantity.isNegative()) throw new Error("Invalid balance");
    if (!quantity.isZero()) balances.set(info.mint, (balances.get(info.mint) ?? new Decimal(0)).add(quantity));
  }
  const tokens = [...balances].map(([mint, amount]) => ({ mint, amount: amount.toFixed() }));
  const unpricedAssets = tokens.length + (sol.isZero() ? 0 : 1);
  return { sol: sol.toFixed(), slot, tokens, unpricedAssets, valueUsd: unpricedAssets ? null : "0",
    recentTransactions: signatures.map((item) => {
      const tx = object(item);
      if (typeof tx.signature !== "string") throw new Error("Invalid signature");
      return { signature: tx.signature, blockTime: typeof tx.blockTime === "number" ? tx.blockTime : null, failed: tx.err !== null };
    }) };
}

export function normalizeMeteora(input: unknown): PlatformBalance {
  const body = object(input);
  const positionCount = count(body.totalPositions);
  array(body.pools);
  if (positionCount === 0) return { status: "empty", valueUsd: "0", positionCount, detail: "No open DLMM positions" };
  // Provider total covers every pool, including those outside the first page.
  const total = object(body.total);
  const valueUsd = decimal(total.balances).add(decimal(total.unclaimedFees)).toFixed();
  return { status: "ready", valueUsd, positionCount, detail: `${positionCount} DLMM positions · includes unclaimed fees` };
}

export function valueWallet(wallet: WalletBalance, quotes: unknown[], nowSeconds = Date.now() / 1000): WalletBalance {
  const prices = new Map<string, Decimal>();
  for (const raw of quotes) {
    try {
      const quote = object(raw);
      const timestamp = decimal(quote.timestamp).toNumber();
      const maxAge = Math.min(300, decimal(quote.maxAgeInSeconds).toNumber());
      const price = decimal(quote.price);
      if (typeof quote.mint === "string" && price.isPositive() && timestamp <= nowSeconds + 30 && nowSeconds - timestamp <= maxAge) prices.set(quote.mint, price);
    } catch { /* Unsupported or malformed oracle rows must not price an asset. */ }
  }
  const assets = [...wallet.tokens, { mint: "So11111111111111111111111111111111111111112", amount: wallet.sol }];
  let total = new Decimal(0), unpricedAssets = 0;
  for (const asset of assets) {
    const amount = new Decimal(asset.amount);
    if (amount.isZero()) continue;
    const price = prices.get(asset.mint);
    if (!price) unpricedAssets++;
    else total = total.add(amount.mul(price));
  }
  return { ...wallet, unpricedAssets, valueUsd: unpricedAssets ? null : total.toFixed() };
}

export function normalizeBulk(input: unknown): PlatformBalance {
  const account = object(object(array(input)[0]).fullAccount);
  const positionCount = array(account.positions).length;
  // totalMargin is not guaranteed to mean account equity. Keep USD unavailable
  // until collateral, funding and unrealized P&L have a reconciled valuation.
  return { status: positionCount ? "ready" : "empty", valueUsd: null, positionCount,
    detail: `${positionCount} BULK positions · equity reconciliation pending` };
}

export function normalizeJupiterPerps(input: unknown): PlatformBalance {
  const body = object(input), positions = array(body.dataList);
  if (count(body.count) !== positions.length) throw new Error("Incomplete Jupiter positions");
  const longs = positions.filter((row) => {
    const side = object(row).side;
    if (side !== "long" && side !== "short") throw new Error("Invalid position side");
    return side === "long";
  });
  // API USD fields are scaled integers. Until funded reconciliation verifies equity
  // and fee semantics, only expose the count, never raw notional as wallet value.
  return { status: longs.length ? "ready" : "empty", positionCount: longs.length, valueUsd: longs.length ? null : "0",
    detail: longs.length ? `${longs.length} open long positions · equity reconciliation pending` : "No open Jupiter long positions" };
}

export function normalizeRiptCatalog(input: unknown): PlatformBalance {
  const body = object(input);
  if (typeof body.chain !== "string" || !body.chain) throw new Error("Missing Ript chain");
  const packs = array(body.packs).map(object).filter((p) => p.status === "available" && count(p.available) > 0);
  const prices = packs.map((p) => {
    const price = decimal(p.priceUsd);
    if (price.isNegative()) throw new Error("Invalid pack price");
    return price;
  });
  const network = body.chain === "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG" ? "devnet"
    : body.chain === MAINNET_GENESIS ? "mainnet" : "unverified network";
  const detail = prices.length
    ? `Catalog: ${network} · ${packs.length} packs from $${Decimal.min(...prices).toFixed()} · challenge pack pending`
    : `Catalog: ${network} · no available packs · challenge pack pending`;
  // Catalog inventory is not the experiment's inventory or its financial position.
  return { status: "needs_setup", valueUsd: null, positionCount: null, detail };
}

export function normalizeKamino(input: unknown, product: "lending" | "earn" = "lending"): PlatformBalance {
  const body = object(input), sections = object(body.sections);
  const section = object(sections[product]);
  if (section.indexed !== true) return { status: "not_indexed", valueUsd: null, positionCount: null, detail: `Kamino ${product} has not indexed this wallet` };
  if (array(section.errors).length) throw new Error("Incomplete Kamino section");
  for (const field of ["positionsRefreshedOn", "pricesRefreshedOn"]) {
    const timestamp = section[field];
    if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp)) || Date.now() - Date.parse(timestamp) > 15 * 60_000) throw new Error("Stale Kamino section");
  }
  const positions = array(body[product]);
  const valueUsd = positions.reduce<Decimal>((sum, item) => sum.add(decimal(object(item).netValue)), new Decimal(0)).toFixed();
  return { status: positions.length ? "ready" : "empty", valueUsd, positionCount: positions.length, detail: `Kamino ${product} balances · rewards excluded` };
}

class UpstreamError extends Error {
  constructor(readonly status: number, readonly code: string | null) { super(`Upstream HTTP ${status}`); }
}
async function json(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) {
    let code: string | null = null;
    try {
      const body = object(await response.json());
      const error = typeof body.error === "object" ? object(body.error) : body;
      if (typeof error.code === "string") code = error.code;
    } catch { /* HTTP errors can be plain text. */ }
    throw new UpstreamError(response.status, code);
  }
  return response.json();
}
async function walletBalance(address: string, rpcUrl: string): Promise<WalletBalance> {
  const rpc = async (method: string, params: unknown[]) => {
    const body = object(await json(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
    if (body.error || body.result === undefined) throw new Error("RPC failure");
    return body.result;
  };
  const native = object(await rpc("getBalance", [address, { commitment: "confirmed" }]));
  if (await rpc("getGenesisHash", []) !== MAINNET_GENESIS) throw new Error("RPC must use mainnet-beta");
  const accounts: unknown[] = [];
  for (const programId of ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]) {
    const result = object(await rpc("getTokenAccountsByOwner", [address, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }]));
    accounts.push(...array(result.value));
  }
  const signatures = array(await rpc("getSignaturesForAddress", [address, { limit: 25, commitment: "confirmed" }]));
  const wallet = normalizeWallet(native.value, accounts, signatures, count(object(native.context).slot));
  if (!wallet.unpricedAssets) return wallet;
  // Pricing can fail without concealing verified token quantities.
  try { return valueWallet(wallet, array(await json("https://api.kamino.finance/oracles/prices?source=scope"))); }
  catch { return wallet; }
}

const connections: Record<typeof CHALLENGE[number]["key"], { source: string; detail: string }> = {
  "jupiter-spot-hold": { source: "https://api.jup.ag/swap/v1/quote", detail: "Select a spot token and record its allocation" },
  "raydium-active-spot": { source: "https://transaction-v1.raydium.io/compute/swap-base-in", detail: "Select trading tokens and record Raydium allocations and fills" },
  "jupiter-perps-long": { source: "https://perps-api.jup.ag/v1/positions", detail: "Read-only long-position sync" },
  "pacifica-short": { source: "https://api.pacifica.fi/api/v1/positions", detail: "Read-only account sync · short strategy" },
  "meteora-liquidity": { source: "https://github.com/MeteoraAg/damm-v2-sdk", detail: "Read-only DAMM v2 pool and prepared position" },
  "kamino-usdc-lending": { source: "https://github.com/Kamino-Finance/klend-sdk", detail: "Direct USDC receipt-token sync" },
  "pump-existing-memecoin": { source: "https://github.com/pump-fun/pump-public-docs", detail: "Select an existing memecoin and record its allocation" },
  "orca-concentrated-liquidity": { source: "https://docs.orca.so/developers/sdks/positions/monitor-positions", detail: "Read-only Whirlpools position discovery" },
  "ript-weekly-pack": { source: "https://ript.fun", detail: "Pending · owner is building a custom challenge pack" },
  "pump-own-launch": { source: "https://github.com/pump-fun/pump-public-docs", detail: "Choose token name, symbol and launch budget · execution disabled" },
};

export async function syncStudio(address: string, rpcUrl: string, previous?: StudioSnapshot, options: { jupiterApiKey?: string; meteoraReceipt?: MeteoraReceipt; entryReceipts?: StationEntryReceipt[]; failedTradeFees?: bigint; recovery?: StudioSnapshot["recovery"] } = {}): Promise<StudioSnapshot> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new Error("Invalid public wallet address");
  const effectiveAddress=options.recovery?.complete?options.recovery.inventory.destination:address;
  if (previous?.address !== effectiveAddress || previous?.network !== "mainnet-beta") previous = undefined;
  const now = new Date().toISOString();
  if(options.recovery){
    const base:StudioSnapshot={version:1,address:effectiveAddress,network:"mainnet-beta",generatedAt:now,wallet:await observe(()=>walletBalance(effectiveAddress,rpcUrl),previous?.wallet,now),platforms:CHALLENGE.map(s=>({id:s.id,strategyKey:s.key,provider:s.provider,source:connections[s.key].source,observation:{status:"needs_setup",checkedAt:now,lastSuccessAt:null,data:null,message:"Recovery in progress"}}))};
    let active:Parameters<typeof applyRecoveryTracking>[3];
    if(options.recovery.complete&&options.meteoraReceipt){
      if(options.meteoraReceipt.wallet!==effectiveAddress)throw new Error("Meteora receipt is not owned by the migrated wallet");
      const prior=previous?.address===effectiveAddress?previous.platforms.find(p=>p.id===5)?.observation:undefined;
      active={wallet:effectiveAddress,observation:await observe(()=>readMeteoraPosition(effectiveAddress,rpcUrl,options.meteoraReceipt!,prior?.data?.performance,now),prior?.data?.performance?prior:undefined,now)};
    }
    const tracked=applyRecoveryTracking(base,options.recovery.inventory,options.recovery.complete,active);
    return options.recovery.complete?applyStationEntryTracking(tracked,options.entryReceipts??[],rpcUrl,previous,now):tracked;
  }
  const walletPromise = observe(() => walletBalance(address, rpcUrl), previous?.wallet, now);
  const priorKamino = previous?.platforms.find(p => p.id === 6 && p.strategyKey === "kamino-usdc-lending")?.observation;
  const kaminoPromise = observe(async () => {
    const [balance, apy] = await Promise.all([readKaminoDirect(address, rpcUrl, priorKamino?.data?.lending, undefined, now, KAMINO_CONFIRMED_ENTRY), readKaminoSupplyApy()]);
    return { ...balance, lending: { ...balance.lending!, supplyApy: apy } };
  }, priorKamino, now);
  const priorMeteora = previous?.platforms.find(p => p.id === 5)?.observation;
  const meteoraPromise = observe(() => options.meteoraReceipt ? readMeteoraPosition(address, rpcUrl, options.meteoraReceipt, priorMeteora?.data?.performance, now) : readMeteoraDamm(address, rpcUrl), priorMeteora?.data?.performance ? priorMeteora : undefined, now);
  const accountingPromise = observe(async () => {
    const balance = KAMINO_CONFIRMED_ENTRY ? await kaminoPromise : undefined;
    if (KAMINO_CONFIRMED_ENTRY && (balance?.status === "unavailable" || !balance?.data)) throw new Error("Kamino reconciliation unavailable");
    const met = options.meteoraReceipt ? await meteoraPromise : undefined;
    if (options.meteoraReceipt && (met?.status === "unavailable" || !met?.data)) throw new Error("Meteora reconciliation unavailable");
    return readActivePositions(address, rpcUrl, previous?.accounting?.data ?? undefined, undefined, now, KAMINO_CONFIRMED_ENTRY ? { entry: KAMINO_CONFIRMED_ENTRY, balance: balance!.data! } : undefined, options.meteoraReceipt ? { entry: options.meteoraReceipt, balance: met!.data! } : undefined, options.failedTradeFees);
  }, previous?.accounting, now);
  let pumpPromise: ReturnType<typeof readPumpPrograms> | undefined;
  const platforms = await Promise.all(CHALLENGE.map(async ({ id, key: strategyKey, provider }) => {
    const { source, detail } = connections[strategyKey];
    const status = id === 9 ? "pending" : "needs_setup";
    const prior = previous?.platforms.find((p) => p.id === id && p.strategyKey === strategyKey && p.provider === provider && (id !== 5 || p.source === source))?.observation;
    let observation: Observation<PlatformBalance> = {
      status, checkedAt: now, lastSuccessAt: null, data: { status, detail, valueUsd: null, positionCount: null }, message: detail,
    };
    if (id !== 9) {
      observation = await observe(async () => {
        if (id === 1 || id === 8) {
          const accounting = await accountingPromise;
          if (accounting.status === "unavailable" || !accounting.data) throw new Error("Active position valuation unavailable");
          const performance = accounting.data.strategies.find(s => s.stationId === id);
          if (!performance) throw new Error("Missing strategy attribution");
          return { status: "ready" as const, valueUsd: performance.equityUsd, positionCount: 1, performance, executionEnabled: false as const,
            connection: { scope: "positions" as const, detail: "Finalized entry attribution + read-only mainnet mark" },
            positions: id === 8 ? [{ address: performance.positionAddress!, pool: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE", liquidity: "157245224", lowerTick: -24612, upperTick: -20556 }] : undefined,
            detail: id === 1 ? `${performance.solAmount} SOL · 30-day hold · execution off`
              : `SOL/USDC · ${performance.inRange ? "in range" : "out of range"} · fees included · execution off` };
        }
        if (id === 2) return readSwapQuote("raydium", options.jupiterApiKey);
        if (id === 3) return { ...normalizeJupiterPerps(await json(`${source}?walletAddress=${address}&includeClosedPositions=false`)),
          connection: { scope: "positions" as const, detail: "Public Jupiter Perps positions · longs only" } };
        if (id === 5) { const result = await meteoraPromise; if (result.status === "unavailable" || !result.data) throw new Error("Meteora unavailable"); return result.data; }
        if (id === 6) {
          const balance = await kaminoPromise;
          if (balance.status === "unavailable" || !balance.data) throw new Error("Kamino receipt reconciliation unavailable");
          if (!KAMINO_CONFIRMED_ENTRY) return balance.data;
          const accounting = await accountingPromise;
          if (accounting.status === "unavailable" || !accounting.data) throw new Error("Kamino allocation reconciliation unavailable");
          return { ...balance.data, performance: accounting.data.strategies.find(s => s.stationId === 6) };
        }
        if (id === 7 || id === 10) {
          pumpPromise ??= readPumpPrograms(rpcUrl);
          const [connection, wallet] = await Promise.all([pumpPromise, walletPromise]);
          if (wallet.status === "unavailable") throw new Error("Wallet read unavailable");
          return { status: "needs_setup" as const, valueUsd: null, positionCount: null, connection,
            detail: id === 7 ? "Chain reader connected · choose existing coin and attribute its trades" : "Chain reader connected · choose launch metadata and budget · execution disabled" };
        }
        const body = object(await json(`${source}?account=${address}`));
        if (body.success !== true) throw new Error("Pacifica read failed");
        const positions = array(body.data);
        let account: Record<string, unknown>;
        try { account = object(await json(`https://api.pacifica.fi/api/v1/account?account=${address}`)); }
        catch (error) {
          if (error instanceof UpstreamError && error.status === 404 && !positions.length) return { status: "empty" as const, valueUsd: null, positionCount: 0, detail: "No open positions · no account data available",
            connection: { scope: "positions" as const, detail: "Pacifica position reader · account creation/deposit pending" } };
          throw error;
        }
        if (account.success !== true) throw new Error("Pacifica account read failed");
        return { status: positions.length ? "ready" as const : "empty" as const, valueUsd: decimal(object(account.data).account_equity).toFixed(),
          positionCount: positions.length, detail: "Pacifica account equity · all account positions",
          connection: { scope: "positions" as const, detail: "Pacifica positions and whole-account equity" } };
      }, prior, now);
      if (observation.status !== "unavailable" && observation.data) {
        observation.status = observation.data.status;
        observation.message = observation.data.detail;
      }
      if (observation.status === "unavailable" && !observation.data && (id === 1 || id === 5 || id === 6 || id === 8)) observation.data = {
        status: "unavailable", valueUsd: null, positionCount: null, detail: "Position reconciliation unavailable · no live P&L shown", executionEnabled: false,
        connection: { scope: "positions", detail: "Read-only attribution requires verified inventory" },
      };
    }
    if (observation.data) observation.data = { ...observation.data, executionEnabled: false };
    return { id, strategyKey, provider, source, observation };
  }));
  return { version: 1, address, network: "mainnet-beta", generatedAt: now, wallet: await walletPromise, platforms, accounting: await accountingPromise };
}
