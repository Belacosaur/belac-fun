/** Budgeted position uses preacquired WSOL+USDC. No native transfer/wrap instructions. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as k from '@solana/kit';
import { parseLpReport, parseObject } from './lp-types.js';
import type { OrcaPool, RpcEnvelope } from './lp-types.js';
interface BudgetedQuote { pool: string; sqrtPriceX64: string; lowerTick: number; upperTick: number; quote: { liquidityDelta: string; tokenMaxA: string; tokenMaxB: string }; maximumPrepSwapUsdcInputAtomsToStayWithinStrategyBudget: string }
const requireSdk = createRequire(createRequire(import.meta.url).resolve('@orca-so/whirlpools'));
const c = requireSdk('@orca-so/whirlpools-client');
const token = requireSdk('@solana-program/token');
const token2022 = requireSdk('@solana-program/token-2022');
const dir = fileURLToPath(new URL('../../../../artifacts/diligence/', import.meta.url));
const json = (x: unknown) => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const report = parseLpReport(await readFile(dir + 'lp-validation.json', 'utf8'));
const budgetSource = await readFile(dir + 'lp-orca-budgeted-quote.json', 'utf8');
const budget = parseObject<BudgetedQuote>(budgetSource);
const pool = report.pools[3] as OrcaPool, state = pool.decoded;
const range = pool.ranges.find(r => r.lower === budget.lowerTick && r.upper === budget.upperTick);
if (!range || pool.id !== budget.pool || String(state.sqrtPrice) !== budget.sqrtPriceX64) throw new Error('Budget quote/saved pool mismatch');
const payer = k.createNoopSigner(k.address(report.wallet));
const mintAddress = k.getAddressDecoder().decode(createHash('sha256').update('BELAC UNSIGNED BUDGETED WSOL SOURCE ONLY').digest());
const positionMint = k.createNoopSigner(mintAddress);
const position = (await c.getPositionAddress(mintAddress))[0];
const positionTokenAccount = (await token.findAssociatedTokenPda({ owner: payer.address, mint: mintAddress, tokenProgram: token2022.TOKEN_2022_PROGRAM_ADDRESS }))[0];
const ataA = k.address(report.sharedRent.associatedTokenAccounts[0].address), ataB = k.address(report.sharedRent.associatedTokenAccounts[1].address);
const common = { whirlpool: k.address(pool.id), positionAuthority: payer, position, positionTokenAccount, tokenMintA: k.address(state.tokenMintA), tokenMintB: k.address(state.tokenMintB), tokenOwnerAccountA: ataA, tokenOwnerAccountB: ataB, tokenVaultA: k.address(state.tokenVaultA), tokenVaultB: k.address(state.tokenVaultB), tokenProgramA: token.TOKEN_PROGRAM_ADDRESS, tokenProgramB: token.TOKEN_PROGRAM_ADDRESS, tickArrayLower: k.address(range.tickArrays[0].address), tickArrayUpper: k.address(range.tickArrays[1].address), remainingAccountsInfo: null };
const open = c.getOpenPositionWithTokenExtensionsInstruction({ funder: payer, owner: payer.address, position, positionMint, positionTokenAccount, whirlpool: k.address(pool.id), tickLowerIndex: budget.lowerTick, tickUpperIndex: budget.upperTick, withTokenMetadataExtension: false });
const add = c.getIncreaseLiquidityV2Instruction({ ...common, liquidityAmount: BigInt(budget.quote.liquidityDelta), tokenMaxA: BigInt(budget.quote.tokenMaxA), tokenMaxB: BigInt(budget.quote.tokenMaxB) });
const withdraw = c.getDecreaseLiquidityV2Instruction({ ...common, liquidityAmount: BigInt(budget.quote.liquidityDelta), tokenMinA: 0n, tokenMinB: 0n });
const claim = c.getCollectFeesV2Instruction(common);
const close = c.getClosePositionWithTokenExtensionsInstruction({ positionAuthority: payer, receiver: payer.address, position, positionMint: mintAddress, positionTokenAccount });
const unwrap = token.getCloseAccountInstruction({ account: ataA, owner: payer, destination: payer.address });
const actions: [string, k.Instruction[]][] = [
  ['open-deposit-preacquired-wsol-usdc', [open, add]],
  ['withdraw-claim-close-position-retain-wallet-atas', [withdraw, claim, close]],
  ['withdraw-claim-close-position-unwrap-wsol-retain-usdc-ata', [withdraw, claim, close, unwrap]],
];
const evidence: unknown[] = [];
async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  if (!['getLatestBlockhash', 'getFeeForMessage'].includes(method)) throw new Error('RPC not allowed');
  const request = { jsonrpc: '2.0', id: evidence.length + 1, method, params };
  const response = await fetch('https://solana-rpc.publicnode.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(20000) });
  const payload = await response.json() as RpcEnvelope<T>;
  evidence.push({ url: 'https://solana-rpc.publicnode.com', at: new Date().toISOString(), request, response: payload, httpStatus: response.status });
  if (!response.ok || payload.error) throw new Error(JSON.stringify(payload));
  return payload.result;
}
const blockhash = (await rpc<{ value: { blockhash: k.Blockhash; lastValidBlockHeight: bigint } }>('getLatestBlockhash', [{ commitment: 'confirmed' }])).value;
const previews = [];
for (const [action, instructions] of actions) {
  const message = k.pipe(k.createTransactionMessage({ version: 0 }), m => k.setTransactionMessageFeePayer(payer.address, m), m => k.setTransactionMessageLifetimeUsingBlockhash(blockhash, m), m => k.appendTransactionMessageInstructions(instructions, m));
  const compiled = k.compileTransactionMessage(message), bytes = Buffer.from(k.getCompiledTransactionMessageEncoder().encode(compiled));
  const wireTransactionBytes = bytes.length + 1 + compiled.header.numSignerAccounts * 64;
  if (wireTransactionBytes > 1232) throw new Error('Unsigned preview exceeds Solana size limit');
  const encoded = bytes.toString('base64');
  const fee = await rpc<{ value: number | null; context: { slot: number } }>('getFeeForMessage', [encoded, { commitment: 'confirmed' }]);
  if (fee.value === null) throw new Error('RPC did not price unsigned message');
  const nativeWrapCount = instructions.filter(ix => ix.programAddress === '11111111111111111111111111111111').length;
  if (nativeWrapCount !== 0) throw new Error('Budgeted preview unexpectedly transfers native SOL');
  previews.push({ action, sourceAssets: 'preacquired wallet WSOL ATA + USDC ATA', nativeSolTransferInstructions: nativeWrapCount, instructionCount: instructions.length, requiredSignatures: compiled.header.numSignerAccounts, wireTransactionBytes, baseFeeLamports: fee.value, feeSlot: fee.context.slot, compiledMessageBase64: encoded, compiledMessageSha256: createHash('sha256').update(bytes).digest('hex'), quote: budget.quote, priorityFeeLamports: null, signed: false, simulated: false, submitted: false });
}
const result = { createdAt: new Date().toISOString(), quoteSource: 'lp-orca-budgeted-quote.json', quoteSourceSha256: createHash('sha256').update(budgetSource).digest('hex'), sourcePoolSnapshotAt: report.createdAt, positionMintPlaceholder: mintAddress, pool: pool.id, tokenAccounts: { wsol: ataA, usdc: ataB }, blockhash, previews, evidence,
  preconditions: ['Fresh successful prep must deliver exactly 41849442 WSOL atoms to the shown wallet ATA and leave at least 5451204 USDC atoms in its USDC ATA.', 'No ATA creation, native SOL transfer, SyncNative or wrap step is included in this preacquired-token entry. Prep/account funding is separate.', 'If prep fails or unwraps WSOL, this entry fails; it must not be replaced with a second native-SOL funding step without revising the strategy budget.', 'The shown legacy-SPL SOL+USDC pool has no token transfer-fee/hook extensions. Position NFT metadata is explicitly disabled.', 'Decrease minima are zero only for read-only diagnostics; fresh executable minima and owner protection are still required.', 'Normal position-close retains wallet ATAs. Optional unwrap variant closes WSOL and returns remaining WSOL SOL plus its rent to the wallet; do not use before a WSOL-source exit swap.', 'Any accrued reward owed must be collected before position-close; these zero-reward diagnostics omit reward claims. Fee RPC does not establish execution success.', 'Blockhash/quotes expire; refresh prep and deposit state together before any separately authorized execution.'], };
await writeFile(dir + 'lp-orca-budgeted-unsigned-previews.json', json(result));
console.log(json(previews.map(p => ({ action: p.action, bytes: p.wireTransactionBytes, signatures: p.requiredSignatures, baseFeeLamports: p.baseFeeLamports, nativeTransfers: p.nativeSolTransferInstructions }))));
