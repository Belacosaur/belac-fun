import { describe, expect, it } from "vitest";
import { inspectMint, summarizeHolders, SecurityRpc } from "./security.js";

const program = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const token2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const mint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const account = (extra = {}) => ({ owner: program, executable: false, space: 82, data: { parsed: { type: "mint", info: { decimals: 6, supply: "1000000000", mintAuthority: null, freezeAuthority: null, isInitialized: true, ...extra } } } });

describe("independent mint security", () => {
  it("only clears explicitly decoded authorities and the correct token program", () => {
    expect(inspectMint(mint, account()).transferChecks).toBe("pass");
    expect(inspectMint(mint, account({ mintAuthority: "issuer" })).transferChecks).toBe("blocked");
    expect(inspectMint(mint, account({ freezeAuthority: undefined })).transferChecks).toBe("blocked");
    expect(inspectMint(mint, { ...account(), owner: "unknown-program" }).transferChecks).toBe("blocked");
  });
  it("permits only understood Token-2022 metadata extensions; flags financial controls", () => {
    const info = { ...account().data.parsed.info, extensions: [{ extension: "metadataPointer", state: { authority: null, metadataAddress: mint } }, { extension: "tokenMetadata", state: { updateAuthority: null, mint } }] };
    const a = { ...account(), owner: token2022, data: { parsed: { type: "mint", info } } };
    expect(inspectMint(mint, a).transferChecks).toBe("pass");
    const risky = { ...a, data: { parsed: { type: "mint", info: { ...info, extensions: [...info.extensions, { extension: "permanentDelegate", state: { delegate: "controller" } }] } } } };
    expect(inspectMint(mint, risky).transferChecks).toBe("blocked");
    expect(inspectMint(mint, risky).findings.join(" ")).toMatch(/permanentDelegate/);
  });
  it("keeps issuer controls explicit on USDC rather than claiming disabled authority", () => {
    const r = inspectMint("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", account({ mintAuthority: "issuer", freezeAuthority: "issuer" }));
    expect(r.transferChecks).toBe("issuer-controlled");
    expect(r.findings.join(" ")).toMatch(/freeze/);
    const issuer = account({ mintAuthority: "issuer", freezeAuthority: "issuer" });
    expect(inspectMint("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", { ...issuer, executable: true }).transferChecks).toBe("blocked");
    expect(inspectMint("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", { ...issuer, executable: undefined }).transferChecks).toBe("blocked");
  });
  it("aggregates exact base units by owner without mistaking a known pool vault for a wallet", () => {
    const holders = [
      { address: "a", amount: "9007199254740993", owner: "same" },
      { address: "b", amount: "9007199254740993", owner: "same" },
      { address: "vault", amount: "100000000000000000", owner: "pool" },
    ];
    const r = summarizeHolders("1000000000000000000", holders, new Set(["vault"]));
    expect(r.knownVaultBaseUnits).toBe("100000000000000000");
    expect(r.largestObservedNonVaultOwnerBaseUnits).toBe("18014398509481986");
    expect(r.observedNonVaultOwnerCount).toBe(1);
    expect(r.fullBeneficialOwnershipVerified).toBe(false);
    expect(() => summarizeHolders("1", [{ address: "bad", amount: "2", owner: "x" }], new Set())).toThrow();
  });
  it("RPC rejects submission methods without sending a request", async () => {
    let count = 0;
    const rpc = new SecurityRpc("https://solana-rpc.publicnode.com", async () => { count++; return new Response('{}'); });
    await expect(rpc.call("sendTransaction", [])).rejects.toThrow(/read/);
    expect(count).toBe(0);
  });
});
