import { expect, it } from "vitest";
import { verifyWalletMessage, sessionHash } from "./trade-auth.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
import { generateKeyPairSync, sign } from "node:crypto";
import { getAddressDecoder } from "@solana/kit";
it("rejects wrong-wallet and malformed authentication without granting trade authority", () => {
  expect(verifyWalletMessage("wrong", "login", Buffer.alloc(64).toString("base64"))).toBe(false);
  expect(verifyWalletMessage(CHALLENGE_WALLET, "login", Buffer.alloc(64).toString("base64"))).toBe(false);
  expect(sessionHash("a")).not.toBe(sessionHash("b")); expect(sessionHash("a")).toHaveLength(64);
});
it("verifies exact Ed25519 messages without needing the real challenge private key", () => {
  const pair = generateKeyPairSync("ed25519"), bytes = pair.publicKey.export({ format: "der", type: "spki" });
  const wallet = getAddressDecoder().decode(bytes.subarray(-32)), message = "login with nonce and origin";
  const signature = sign(null, Buffer.from(message), pair.privateKey).toString("base64");
  expect(verifyWalletMessage(wallet, message, signature, wallet)).toBe(true);
  expect(verifyWalletMessage(wallet, message + " changed", signature, wallet)).toBe(false);
  expect(verifyWalletMessage(wallet, message, signature)).toBe(false);
});
