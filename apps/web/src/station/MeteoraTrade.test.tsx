import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { CHALLENGE_WALLET } from "../../../../packages/contracts/src/trades";
import { MeteoraTrade } from "./MeteoraTrade";
const fixture = JSON.parse(await readFile("../jobs/src/fixtures/meteora-builder-mainnet.json", "utf8"));
const mock = vi.hoisted(() => ({ wallets: [] as unknown[], events: [] as string[], sign: vi.fn(), finish: vi.fn(), generate: vi.fn() }));
vi.mock("@wallet-standard/app", () => ({ getWallets: () => ({ get: () => mock.wallets, on: () => () => undefined }) }));
vi.mock("@solana/kit", async original => ({ ...await original<typeof import("@solana/kit")>(), generateKeyPairSigner: () => mock.generate() }));
vi.mock("./trade-wallet", async original => ({ ...await original<typeof import("./trade-wallet")>(), validateMeteoraPlan: vi.fn().mockResolvedValue({}), verifyLivePlanContext: vi.fn().mockResolvedValue(undefined), finishWalletSignature: (...args: unknown[]) => mock.finish(...args), browserRpc: vi.fn().mockImplementation(async (method: string) => { mock.events.push(method); return "mock-signature"; }) }));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  mock.events.length = 0; mock.sign.mockReset(); mock.finish.mockReset(); mock.generate.mockResolvedValue({ address: fixture.plan.mint });
  const account = { address: CHALLENGE_WALLET };
  mock.wallets = [{ name: "Test wallet", accounts: [account], features: { "standard:connect": { connect: async () => ({ accounts: [account] }) }, "solana:signMessage": { signMessage: async () => [{ signature: new Uint8Array(64) }] }, "solana:signTransaction": { signTransaction: mock.sign } } }];
  const attempt = { id: "attempt", wallet: CHALLENGE_WALLET, state: "ready", plan: { ...fixture.plan, expiresAt: new Date(Date.now() + 45000).toISOString() } };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const path = String(url); mock.events.push(path.split("/v1/trades/")[1]!);
    const data = path.endsWith("wallet/challenge") ? { id: "nonce", message: "Login only" } : path.endsWith("wallet/session") ? { token: "session" } : path.endsWith("latest") ? null : path.endsWith("/signature") ? { ...attempt, state: "submitted", signature: "mock-signature" } : attempt;
    return new Response(JSON.stringify({ data }), { status: 200 });
  }));
});
it("shows no wallet execution action until an authenticated preparation exists", async () => {
  render(<MeteoraTrade onClose={() => undefined} onRefresh={() => undefined}/>);
  expect(screen.queryByText("Sign and execute in wallet")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Connect and authenticate"));
  await waitFor(() => expect(screen.getByText("Prepare $10 Meteora entry")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Prepare $10 Meteora entry"));
  await waitFor(() => expect(screen.getByText("Sign and execute in wallet")).toBeEnabled());
  expect(screen.getByText("Recoverable account rent")).toBeInTheDocument();
  expect(mock.sign).not.toHaveBeenCalled(); expect(mock.events).not.toContain("sendTransaction");
});
it("registers the signature before mocked browser submission after an explicit click", async () => {
  mock.sign.mockResolvedValue([{ signedTransaction: new Uint8Array([1]) }]); mock.finish.mockResolvedValue({ wire: new Uint8Array([1]), signature: "mock-signature" });
  render(<MeteoraTrade onClose={() => undefined} onRefresh={() => undefined}/>);
  fireEvent.click(screen.getByText("Connect and authenticate")); await waitFor(() => expect(screen.getByText("Prepare $10 Meteora entry")).toBeEnabled());
  fireEvent.click(screen.getByText("Prepare $10 Meteora entry")); await waitFor(() => expect(screen.getByText("Sign and execute in wallet")).toBeEnabled());
  fireEvent.click(screen.getByText("Sign and execute in wallet"));
  await waitFor(() => expect(mock.events).toContain("sendTransaction"));
  expect(mock.events.indexOf("meteora/attempt/signature")).toBeLessThan(mock.events.indexOf("sendTransaction"));
  expect(mock.sign).toHaveBeenCalledTimes(1);
});
it("does not submit or register a transaction when the wallet rejects", async () => {
  mock.sign.mockRejectedValue(new Error("User rejected the wallet request"));
  render(<MeteoraTrade onClose={() => undefined} onRefresh={() => undefined}/>);
  fireEvent.click(screen.getByText("Connect and authenticate")); await waitFor(() => expect(screen.getByText("Prepare $10 Meteora entry")).toBeEnabled());
  fireEvent.click(screen.getByText("Prepare $10 Meteora entry")); await waitFor(() => expect(screen.getByText("Sign and execute in wallet")).toBeEnabled());
  fireEvent.click(screen.getByText("Sign and execute in wallet")); await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("User rejected"));
  expect(mock.events).not.toContain("sendTransaction"); expect(mock.events).not.toContain("meteora/attempt/signature");
});
