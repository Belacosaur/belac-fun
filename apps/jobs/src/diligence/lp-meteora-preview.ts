/** Compact-range DLMM diagnostics encoded from the official IDL. Unsigned only. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import * as k from '@solana/kit';
import { discretePosition } from './lp-math.js';
import { parseLpReport, parseObject } from './lp-types.js';
import type { Idl, MeteoraPool, RpcEnvelope } from './lp-types.js';
const dir = fileURLToPath(new URL('../../../../artifacts/diligence/', import.meta.url));
const report = parseLpReport(await readFile(dir + 'lp-validation.json', 'utf8'));
const idl = parseObject<Idl>(await readFile(dir + 'lp-meteora-idl-idl.json', 'utf8'));
const sdk = createRequire(createRequire(import.meta.url).resolve('@orca-so/whirlpools'));
const token = sdk('@solana-program/token'), system = sdk('@solana-program/system');
const program = k.address('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');
const payer = k.createNoopSigner(k.address(report.wallet));
const eventAuthority = (await k.getProgramDerivedAddress({ programAddress: program, seeds: [new TextEncoder().encode('__event_authority')] }))[0];
const evidence: unknown[] = [];
async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  if (!['getLatestBlockhash', 'getFeeForMessage'].includes(method)) throw new Error('Prohibited method');
  const request = { jsonrpc: '2.0', id: evidence.length + 1, method, params };
  const r = await fetch('https://solana-rpc.publicnode.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(20000) });
  const response = await r.json() as RpcEnvelope<T>; evidence.push({ request, response, httpStatus: r.status, at: new Date().toISOString() });
  if (!r.ok || response.error) throw new Error(JSON.stringify(response));
  return response.result;
}
function n(v: number | bigint, bytes: number, signed = false) {
  const b = Buffer.alloc(bytes);
  if (bytes === 8) b.writeBigUInt64LE(BigInt(v));
  else if (signed) b.writeIntLE(Number(v), 0, bytes);
  else b.writeUIntLE(Number(v), 0, bytes);
  return b;
}
function ix(name: string, accounts: Record<string, string>, args: Buffer[], extras: string[] = []): k.Instruction {
  const definition = idl.instructions.find(d => d.name === name);
  if (!definition) throw new Error('Unknown IDL instruction');
  return { programAddress: program, accounts: [...definition.accounts.map(a => {
    const address = k.address(accounts[a.name] ?? a.address ?? (a.optional ? program : ''));
    const role = a.signer ? (a.writable ? k.AccountRole.WRITABLE_SIGNER : k.AccountRole.READONLY_SIGNER) : (a.writable && address !== program ? k.AccountRole.WRITABLE : k.AccountRole.READONLY);
    return { address, role };
  }), ...extras.map(address => ({ address: k.address(address), role: k.AccountRole.WRITABLE }))], data: Buffer.concat([Buffer.from(definition.discriminator), ...args]) };
}
const blockhash = (await rpc<{ value: { blockhash: k.Blockhash; lastValidBlockHeight: bigint } }>('getLatestBlockhash', [{ commitment: 'confirmed' }])).value;
const previews: { pool: string; binStep: number; widthPct: number; action: string; transactionBytes: number; baseFeeLamports: number | null; [field: string]: unknown }[] = [];
for (const [poolIndex, widths] of [[1, [3]], [2, [3, 5]]] as const) {
  const pool = report.pools[poolIndex] as MeteoraPool;
  for (const width of widths) {
    const range = pool.ranges.find(r => r.requestedWidthPct === width);
    if (!range || range.count === undefined || !range.existingBinArrays) throw new Error('Missing DLMM range details');
    if (range.count > 70) throw new Error('This preview deliberately handles only inline positions');
    const allocation = discretePosition(pool.priceUsdcPerSol, pool.decoded.active_id, pool.decoded.bin_step, range.lower, range.upper);
    const position = k.getAddressDecoder().decode(createHash('sha256').update(`BELAC UNSIGNED DLMM ${pool.id} ${width}`).digest());
    const userX = report.sharedRent.associatedTokenAccounts[0].address, userY = report.sharedRent.associatedTokenAccounts[1].address;
    const accounts = { payer: payer.address, position, owner: payer.address, sender: payer.address, rent_receiver: payer.address, lb_pair: pool.id, reserve_x: pool.decoded.reserve_x, reserve_y: pool.decoded.reserve_y, user_token_x: userX, user_token_y: userY, token_x_mint: pool.decoded.token_x_mint, token_y_mint: pool.decoded.token_y_mint, token_x_program: token.TOKEN_PROGRAM_ADDRESS, token_y_program: token.TOKEN_PROGRAM_ADDRESS, token_program_x: token.TOKEN_PROGRAM_ADDRESS, token_program_y: token.TOKEN_PROGRAM_ADDRESS, event_authority: eventAuthority, program };
    const arrays = range.existingBinArrays.map(a => a.address);
    const init = ix('initialize_position2', accounts, [n(range.lower, 4, true), n(range.count, 4, true)]);
    const creates = [pool.decoded.token_x_mint, pool.decoded.token_y_mint].map((mint: string, i: number) => token.getCreateAssociatedTokenIdempotentInstruction({ payer, owner: payer.address, mint: k.address(mint), ata: k.address([userX, userY][i]), tokenProgram: token.TOKEN_PROGRAM_ADDRESS }));
    const wrap = system.getTransferSolInstruction({ source: payer, destination: k.address(userX), amount: BigInt(allocation.inputSolAtoms) });
    const sync = token.getSyncNativeInstruction({ account: k.address(userX) });
    const distribution = allocation.bins.flatMap(b => [n(b.id, 4, true), n(b.distributionXBps, 2), n(b.distributionYBps, 2)]);
    const add = ix('add_liquidity2', accounts, [n(allocation.inputSolAtoms, 8), n(allocation.inputUsdcAtoms, 8), n(allocation.bins.length, 4), ...distribution, n(0, 4)], arrays);
    const remove = ix('remove_liquidity2', accounts, [n(allocation.bins.length, 4), ...allocation.bins.flatMap(b => [n(b.id, 4, true), n(10000, 2)]), n(0, 4)], arrays);
    const claim = ix('claim_fee2', accounts, [n(range.lower, 4, true), n(range.upper, 4, true), n(0, 4)], arrays);
    const close = ix('close_position2', accounts, []);
    let actions: [string, k.Instruction[]][] = [['setup-wrap-initialize', [...creates, wrap, sync, init]], ['deposit', [add]], ['withdraw-claim-close', [remove, claim, close]]];
    const encode = (instructions: k.Instruction[]) => {
      const message = k.pipe(k.createTransactionMessage({ version: 0 }), m => k.setTransactionMessageFeePayer(payer.address, m), m => k.setTransactionMessageLifetimeUsingBlockhash(blockhash, m), m => k.appendTransactionMessageInstructions(instructions, m));
      const compiled = k.compileTransactionMessage(message), bytes = Buffer.from(k.getCompiledTransactionMessageEncoder().encode(compiled));
      return { compiled, bytes, transactionBytes: bytes.length + 1 + compiled.header.numSignerAccounts * 64 };
    };
    const combinedEntry = [...creates, wrap, sync, init, add];
    if (encode(combinedEntry).transactionBytes <= 1232) actions = [['setup-wrap-initialize-deposit', combinedEntry], ['withdraw-claim-close', [remove, claim, close]]];
    for (const [action, instructions] of actions) {
      const { compiled, bytes, transactionBytes } = encode(instructions);
      if (transactionBytes > 1232) throw new Error(`Preview does not fit: ${action} ${transactionBytes}`);
      const encoded = bytes.toString('base64'), fee = await rpc<{ value: number | null; context: { slot: number } }>('getFeeForMessage', [encoded, { commitment: 'confirmed' }]);
      if (fee.value === null) throw new Error('RPC did not price the unsigned DLMM message');
      previews.push({ pool: pool.id, binStep: pool.decoded.bin_step, widthPct: width, lowerBin: range.lower, upperBin: range.upper, bins: range.count, action, transactionBytes, requiredSignatures: compiled.header.numSignerAccounts, compiledMessageBase64: encoded, compiledMessageSha256: createHash('sha256').update(bytes).digest('hex'), baseFeeLamports: fee.value, slot: fee.context.slot, inputSolAtoms: allocation.inputSolAtoms, inputUsdcAtoms: allocation.inputUsdcAtoms, resultingDeployedUsd: allocation.deployedUsd, idleDustUsd: allocation.idleDustUsd, priorityFeeLamports: null, signed: false, sent: false, simulated: false });
    }
  }
}
await writeFile(dir + 'lp-meteora-unsigned-previews.json', JSON.stringify({ createdAt: new Date().toISOString(), noKeysGeneratedOrRead: true, blockhash, previews, evidence, limitations: ['Read-only feeForMessage does not execute or validate program success.', 'Only <=70-bin compact positions priced. Larger ranges need position extensions and multiple liquidity chunks; their exact network fees remain unknown.', 'Position and owner signature requirements remain in the unsigned message; no signer keys exist for placeholders.', 'No explicit compute-budget or priority setting; these remain unpriced.', 'Custom per-token weights apportion equal initial USD per bin to 10000 BPS. Floors leave token dust idle.', 'add_liquidity2 has no active-bin slippage argument; a final executable plan must choose safeguards such as current price revalidation or a strategy endpoint with an active-bin bound.'] }, null, 2));
console.log(JSON.stringify(previews.map(p => ({ pool: p.pool, widthPct: p.widthPct, action: p.action, transactionBytes: p.transactionBytes, baseFeeLamports: p.baseFeeLamports })), null, 2));
