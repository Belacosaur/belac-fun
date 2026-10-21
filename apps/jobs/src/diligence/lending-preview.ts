import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { LendingValidation } from './lending-collect.js';

interface BuilderInstruction { programAddress: string; data: string; accounts: { address: string; role: string }[] }
interface BuilderResponse { instructions?: BuilderInstruction[]; code?: string }

// This calls only documented unsigned instruction builders. No signer, RPC transaction
// submission, or executable transaction serialization is available in this module.
const out = new URL('../../../../artifacts/diligence/', import.meta.url);
const validation: LendingValidation = JSON.parse(await readFile(new URL('lending-validation.json', out), 'utf8'));
if (!Array.isArray(validation.reports)) throw new Error('Invalid saved reserve validation');
const evidence = [];
for (const reserve of validation.reports) {
  const name = reserve.name === 'JLP' ? 'jlp' : 'solbtc';
  const request = { wallet: validation.wallet, market: reserve.market, reserve: reserve.reserve, amount: '10' };
  for (const action of ['deposit', 'withdraw'] as const) {
    const url = `https://api.kamino.finance/ktx/klend/${action}-instructions`;
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(25_000) });
    const body = await response.text();
    const file = `lending-${action === 'deposit' ? '' : 'withdraw-'}preview-${name}${response.ok ? '' : '-error'}.json`;
    await writeFile(new URL(file, out), body);
    await writeFile(new URL(`lending-preview-${name}-request.json`, out), JSON.stringify(request));
    const data: BuilderResponse = JSON.parse(body);
    if (response.ok && action === 'deposit') {
      if (!Array.isArray(data.instructions) || data.instructions.length !== 9) throw new Error('Unexpected deposit preview shape');
      const final = data.instructions.at(-1);
      if (!final || !Array.isArray(final.accounts)) throw new Error('Missing final deposit instruction');
      const finalData = Buffer.from(final.data, 'base64');
      const amount = finalData.readBigUInt64LE(8);
      if (finalData.length !== 16 || !finalData.subarray(0, 8).equals(Buffer.from([216, 224, 191, 27, 204, 151, 102, 175])) || amount !== 10_000_000n || final.programAddress !== 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD') throw new Error('Unexpected reserve deposit instruction');
      if (final.accounts[2].address !== reserve.market || final.accounts[4].address !== reserve.reserve || final.accounts[5].address !== 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') throw new Error('Unexpected preview deposit account');
      const programs = new Set(['ComputeBudget111111111111111111111111111111', 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', 'AddressLookupTab1e1111111111111111111111111', 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD']);
      if (data.instructions.some(ix => !programs.has(ix.programAddress))) throw new Error('Unexpected preview program');
      const signers = [...new Set(data.instructions.flatMap(ix => ix.accounts.filter(a => a.role.endsWith('SIGNER')).map(a => a.address)))];
      if (signers.length !== 1 || signers[0] !== validation.wallet) throw new Error('Unexpected preview signer');
    }
    evidence.push({ request, action, url, method: 'POST', semantics: 'Returns unsigned instructions only; no transaction submitted', status: response.status,
      file, fetchedAt: new Date().toISOString(), sha256: createHash('sha256').update(body).digest('hex'),
      errorCode: response.ok ? null : data.code });
  }
}
await writeFile(new URL('lending-preview-evidence.json', out), JSON.stringify({ executionEnabled: false, evidence }, null, 2));
console.log(evidence.map(e => ({ action: e.action, reserve: e.request.reserve, status: e.status, errorCode: e.errorCode })));
