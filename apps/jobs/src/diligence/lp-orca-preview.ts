/** Unsigned messages and fee reads only. No keys, signatures, sends or wallet secrets. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as k from '@solana/kit';
import { parseLpReport } from './lp-types.js';
import type { LiquidityQuote, OrcaPool, RpcEnvelope } from './lp-types.js';
const requireSdk = createRequire(createRequire(import.meta.url).resolve('@orca-so/whirlpools'));
const c = requireSdk('@orca-so/whirlpools-client');
const core = requireSdk('@orca-so/whirlpools-core');
const token = requireSdk('@solana-program/token');
const token2022 = requireSdk('@solana-program/token-2022');
const system = requireSdk('@solana-program/system');
const dir = fileURLToPath(new URL('../../../../artifacts/diligence/', import.meta.url));
const json = (x: unknown) => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
const report = parseLpReport(await readFile(dir + 'lp-validation.json', 'utf8'));
const p = report.pools[3] as OrcaPool, state = p.decoded, payer = k.createNoopSigner(k.address(report.wallet));
const mintAddress = k.getAddressDecoder().decode(createHash('sha256').update('BELAC UNSIGNED LP RENT PREVIEW ONLY').digest());
const positionMint = k.createNoopSigner(mintAddress);
const position = (await c.getPositionAddress(mintAddress))[0];
const positionTokenAccount = (await token.findAssociatedTokenPda({ owner: payer.address, mint: mintAddress, tokenProgram: token2022.TOKEN_2022_PROGRAM_ADDRESS }))[0];
const a = report.sharedRent.associatedTokenAccounts[0].address, b = report.sharedRent.associatedTokenAccounts[1].address;
const evidence: unknown[] = [];
async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  if (!['getLatestBlockhash', 'getFeeForMessage'].includes(method)) throw new Error('RPC method not allowed');
  const request = { jsonrpc: '2.0', id: evidence.length + 1, method, params };
  const response = await fetch('https://solana-rpc.publicnode.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(20000) });
  const payload = await response.json() as RpcEnvelope<T>; evidence.push({ request, response: payload, httpStatus: response.status, at: new Date().toISOString() });
  if (payload.error || !response.ok) throw new Error(JSON.stringify(payload));
  return payload.result;
}
const blockhash = (await rpc<{ value: { blockhash: k.Blockhash; lastValidBlockHeight: bigint } }>('getLatestBlockhash', [{ commitment: 'confirmed' }])).value;
const previews: { widthPct: number; action: string; requiredSignatures: number; serializedTransactionBytes: number; baseFeeLamports: number | null; quoteValueUsdc: number; [field: string]: unknown }[] = [];
for (const range of p.ranges) {
  const capA = BigInt(range.atomicDepositCaps.solAtoms), capB = BigInt(range.atomicDepositCaps.usdcAtoms);
  let quote = core.increaseLiquidityQuoteA(capA, 0, BigInt(state.sqrtPrice), range.lower, range.upper) as LiquidityQuote;
  if (quote.tokenMaxB > capB) quote = core.increaseLiquidityQuoteB(capB, 0, BigInt(state.sqrtPrice), range.lower, range.upper);
  if (quote.tokenMaxA > capA || quote.tokenMaxB > capB) throw new Error('Quote exceeds atomic budget caps');
  const common = { whirlpool: k.address(p.id), positionAuthority: payer, position, positionTokenAccount, tokenMintA: k.address(state.tokenMintA), tokenMintB: k.address(state.tokenMintB), tokenOwnerAccountA: k.address(a), tokenOwnerAccountB: k.address(b), tokenVaultA: k.address(state.tokenVaultA), tokenVaultB: k.address(state.tokenVaultB), tokenProgramA: token.TOKEN_PROGRAM_ADDRESS, tokenProgramB: token.TOKEN_PROGRAM_ADDRESS, tickArrayLower: k.address(range.tickArrays[0].address), tickArrayUpper: k.address(range.tickArrays[1].address), remainingAccountsInfo: null };
  const open = c.getOpenPositionWithTokenExtensionsInstruction({ funder: payer, owner: payer.address, position, positionMint, positionTokenAccount, whirlpool: k.address(p.id), tickLowerIndex: range.lower, tickUpperIndex: range.upper, withTokenMetadataExtension: false });
  const add = c.getIncreaseLiquidityV2Instruction({ ...common, liquidityAmount: quote.liquidityDelta, tokenMaxA: quote.tokenMaxA, tokenMaxB: quote.tokenMaxB });
  const creates = [state.tokenMintA, state.tokenMintB].map((mint: string, i: number) => token.getCreateAssociatedTokenIdempotentInstruction({ payer, owner: payer.address, mint: k.address(mint), ata: k.address([a, b][i]), tokenProgram: token.TOKEN_PROGRAM_ADDRESS }));
  const wrap = system.getTransferSolInstruction({ source: payer, destination: k.address(a), amount: quote.tokenMaxA });
  const sync = token.getSyncNativeInstruction({ account: k.address(a) });
  const withdraw = c.getDecreaseLiquidityV2Instruction({ ...common, liquidityAmount: quote.liquidityDelta, tokenMinA: 0n, tokenMinB: 0n });
  const claim = c.getCollectFeesV2Instruction(common);
  const close = c.getClosePositionWithTokenExtensionsInstruction({ positionAuthority: payer, receiver: payer.address, position, positionMint: mintAddress, positionTokenAccount });
  const setups: [string, k.Instruction[]][] = [['open-and-deposit', [...creates, wrap, sync, open, add]], ['withdraw-claim-close', [withdraw, claim, close]]];
  for (const [action, instructions] of setups) {
    const message = k.pipe(k.createTransactionMessage({ version: 0 }), m => k.setTransactionMessageFeePayer(payer.address, m), m => k.setTransactionMessageLifetimeUsingBlockhash(blockhash, m), m => k.appendTransactionMessageInstructions(instructions, m));
    const compiled = k.compileTransactionMessage(message);
    const bytes = k.getCompiledTransactionMessageEncoder().encode(compiled);
    const encoded = Buffer.from(bytes).toString('base64');
    const fee = await rpc<{ value: number | null; context: { slot: number } }>('getFeeForMessage', [encoded, { commitment: 'confirmed' }]);
    if (fee.value === null) throw new Error('RPC did not price the unsigned Orca message');
    previews.push({ widthPct: range.requestedWidthPct, action, compiledMessageBase64: encoded, compiledMessageSha256: createHash('sha256').update(Buffer.from(bytes)).digest('hex'), requiredSignatures: compiled.header.numSignerAccounts, serializedTransactionBytes: bytes.length + 1 + 64 * compiled.header.numSignerAccounts, instructionCount: instructions.length, baseFeeLamports: fee.value, feeSlot: fee.context.slot, quote, quoteValueUsdc: Number(quote.tokenMaxA) / 1e9 * p.priceUsdcPerSol + Number(quote.tokenMaxB) / 1e6,
      priorityFeeLamports: null, simulated: false, signed: false, sent: false });
  }
}
await writeFile(dir + 'lp-orca-unsigned-previews.json', json({ createdAt: new Date().toISOString(), sdk: '@orca-so/whirlpools 8.0.1; client 7.0.0; core 3.1.0', sourceAssetMode: 'native-SOL-source diagnostic; includes native SOL transfer plus SyncNative', notForPrepAcquiredWsol: true, prepLinkedReplacement: 'lp-orca-budgeted-unsigned-previews.json', publicPlaceholderMint: mintAddress, noKeysGeneratedOrRead: true, blockhash, previews, evidence, limitations: ['Messages expire at blockhash lifetime and were never signed or submitted.', 'Fee RPC prices signatures; it does not validate account existence or instruction success.', 'Payer is unfunded; no successful execution simulation is claimed.', 'Priority/compute fee is unquoted; withdrawal minima are zero only in this unsigned diagnostic preview and must be replaced with owner-approved protection.', 'Entry source tokens are already held SOL+USDC; obtaining deposit assets by swap is separate.', 'User ATAs persist; their rent is recovered only when they are emptied and explicitly closed.'] }));
console.log(json(previews.map(({ widthPct, action, requiredSignatures, serializedTransactionBytes, baseFeeLamports, quoteValueUsdc }) => ({ widthPct, action, requiredSignatures, serializedTransactionBytes, baseFeeLamports, quoteValueUsdc }))));
