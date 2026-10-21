import { syncStudio } from "./studio-sync.js";

// Read-only diagnostic. Does not load a keypair, touch Postgres or create jobs.
const snapshot = await syncStudio(
  process.env.EXPERIMENT_WALLET_ADDRESS || "HBFn6VWPLNt44i8zqUoNs4mMtqyyxNTyWwQqfH5TBx8j",
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  undefined,
  { jupiterApiKey: process.env.JUPITER_API_KEY },
);
console.log(JSON.stringify(snapshot, null, 2));
if (snapshot.wallet.status === "unavailable" || snapshot.platforms.some((p) => p.id !== 9 && p.observation.status === "unavailable")) process.exitCode = 1;
