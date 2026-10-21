import { createHash, createPublicKey, verify } from "node:crypto";
import { getAddressEncoder } from "@solana/kit";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
export const sessionHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function verifyWalletMessage(wallet: string, message: string, signature: string, expectedWallet = CHALLENGE_WALLET): boolean {
  try {
    if (wallet !== expectedWallet || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
    const key = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(getAddressEncoder().encode(wallet as Parameters<ReturnType<typeof getAddressEncoder>["encode"]>[0]))]), format: "der", type: "spki" });
    return verify(null, Buffer.from(message), key, Buffer.from(signature, "base64"));
  } catch { return false; }
}
