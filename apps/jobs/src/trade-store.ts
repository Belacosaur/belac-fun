import { randomUUID, randomBytes } from "node:crypto";
import type pg from "pg";
import type { TradeAttempt, MeteoraPlan, MeteoraReceipt, TradeState } from "../../../packages/contracts/src/trades.js";
import { CHALLENGE_WALLET } from "../../../packages/contracts/src/trades.js";
import { sessionHash, verifyWalletMessage } from "./trade-auth.js";
type Row = { id: string; wallet: string; station: 5; state: TradeState; mint: string; created_at: Date; plan: MeteoraPlan | null; signature: string | null; error: string | null; receipt: MeteoraReceipt | null };
const attempt = (r: Row): TradeAttempt => ({ id: r.id, wallet: r.wallet, station: r.station, state: r.state, mint: r.mint, createdAt: r.created_at.toISOString(), plan: r.plan, signature: r.signature, error: r.error, receipt: r.receipt });
export class TradeStore {
  constructor(readonly pool: pg.Pool, private verifyMessage = verifyWalletMessage, readonly wallet: string = CHALLENGE_WALLET) {}
  async challenge(origin: string) {
    const id = randomUUID(), expiresAt = new Date(Date.now() + 120000).toISOString();
    const message = `Belac.fun wallet login\nOrigin: ${origin}\nWallet: ${this.wallet}\nNetwork: solana:mainnet\nNonce: ${id}\nExpires: ${expiresAt}\nThis authenticates your session only. It does not authorize any transaction.`;
    await this.pool.query("insert into wallet_trade_challenges(id,wallet,origin,message,expires_at) values($1,$2,$3,$4,$5)", [id, this.wallet, origin, message, expiresAt]);
    return { id, message, expiresAt, wallet: this.wallet };
  }
  async login(origin: string, id: string, signature: string) {
    const token = randomBytes(32).toString("base64url");
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const r = await client.query("select * from wallet_trade_challenges where id=$1 and origin=$2 and used=false and expires_at>now() for update", [id, origin]);
      const c = r.rows[0]; if (!c || c.wallet !== this.wallet || !this.verifyMessage(c.wallet, c.message, signature, this.wallet)) throw new Error("Wallet authentication failed");
      await client.query("update wallet_trade_challenges set used=true where id=$1", [id]);
      await client.query("insert into wallet_trade_sessions values($1,$2,$3,now()+interval '30 minutes')", [sessionHash(token), this.wallet, origin]);
      await client.query("commit"); return { token, wallet: this.wallet };
    } catch (e) { await client.query("rollback"); throw e; } finally { client.release(); }
  }
  async authorized(origin: string, token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
    return (await this.pool.query("select 1 from wallet_trade_sessions where token_hash=$1 and wallet=$2 and origin=$3 and expires_at>now()", [sessionHash(token), this.wallet, origin])).rowCount === 1;
  }
  async latest() { const r = await this.pool.query<Row>("select * from wallet_trade_attempts where wallet=$1 and station=5 order by created_at desc limit 1", [this.wallet]); return r.rows[0] ? attempt(r.rows[0]) : null; }
  async get(id: string) { const r = await this.pool.query<Row>("select * from wallet_trade_attempts where id=$1 and wallet=$2", [id, this.wallet]); return r.rows[0] ? attempt(r.rows[0]) : null; }
  async create(mint: string) {
    const id = randomUUID(), c=await this.pool.connect();
    // Unique index retains a reservation through uncertain submissions and through the one active position.
    try{await c.query("begin");await c.query("select pg_advisory_xact_lock(hashtext($1))",["station-entries:"+this.wallet]);
      if((await c.query("select to_regclass('station_entry_attempts') as table_name")).rows[0]?.table_name){
        const pending=await c.query("select 1 from station_entry_attempts where wallet=$1 and state in ('preparing','ready','signing','submitted','unknown') limit 1",[this.wallet]);
        if(pending.rowCount)throw new Error("Another station review requires reconciliation first");
      }
      await c.query("insert into wallet_trade_attempts(id,wallet,station,mint,state) values($1,$2,5,$3,'queued')", [id, this.wallet, mint]);await c.query("commit");
    }catch(e){await c.query("rollback");throw e;}finally{c.release();}
    return (await this.get(id))!;
  }
  async claim() {
    const r = await this.pool.query<Row>(`update wallet_trade_attempts set state='preparing',lease_until=now()+interval '90 seconds',updated_at=now()
      where id=(select id from wallet_trade_attempts where wallet=$1 and (state='queued' or (state='preparing' and lease_until<now())) order by created_at for update skip locked limit 1) returning *`,[this.wallet]);
    return r.rows[0] ? attempt(r.rows[0]) : null;
  }
  async publish(id: string, plan: MeteoraPlan) { if(plan.wallet!==this.wallet)throw new Error("Plan wallet differs from trade owner"); await this.pool.query("update wallet_trade_attempts set state='ready',plan=$2,updated_at=now() where id=$1 and wallet=$3 and state='preparing'", [id, plan, this.wallet]); }
  async fail(id: string) { await this.pool.query("update wallet_trade_attempts set state='failed',error='Preparation failed validation. No transaction was submitted.',updated_at=now() where id=$1 and wallet=$2 and state='preparing'", [id, this.wallet]); }
  async begin(id: string) {
    const r = await this.pool.query<Row>("update wallet_trade_attempts set state='awaiting_submission',updated_at=now() where id=$1 and wallet=$2 and state='ready' and (plan->>'expiresAt')::timestamptz>now() returning *", [id, this.wallet]);
    if (!r.rows[0]) throw new Error("Plan expired or already claimed"); return attempt(r.rows[0]);
  }
  async register(id: string, signature: string) {
    const r = await this.pool.query("update wallet_trade_attempts set signature=$2,state='submitted',updated_at=now() where id=$1 and wallet=$3 and state in ('awaiting_submission','submitted','unknown') and (signature is null or signature=$2)", [id, signature, this.wallet]);
    if (r.rowCount !== 1) throw new Error("Attempt cannot accept this signature");
  }
  async cancel(id: string) { return (await this.pool.query("update wallet_trade_attempts set state='cancelled',updated_at=now() where id=$1 and wallet=$2 and state in ('queued','preparing','ready')", [id, this.wallet])).rowCount === 1; }
  async pending() { return (await this.pool.query<Row>("select * from wallet_trade_attempts where wallet=$1 and state in ('awaiting_submission','submitted','confirmed','unknown') order by created_at limit 10",[this.wallet])).rows.map(attempt); }
  async mark(id: string, state: "confirmed" | "failed" | "unknown" | "expired", error: string | null = null) { await this.pool.query("update wallet_trade_attempts set state=$2,error=$3,updated_at=now() where id=$1 and wallet=$4 and state in ('awaiting_submission','submitted','confirmed','unknown')", [id, state, error, this.wallet]); }
  async reconcile(id: string, receipt: MeteoraReceipt) { await this.pool.query("update wallet_trade_attempts set state='reconciled',receipt=$2,error=null,updated_at=now() where id=$1 and wallet=$3 and state in ('submitted','confirmed','unknown')", [id, receipt, this.wallet]); }
  async receipt(): Promise<MeteoraReceipt | undefined> { return (await this.pool.query("select receipt from wallet_trade_attempts where wallet=$1 and state='reconciled' and receipt is not null", [this.wallet])).rows[0]?.receipt; }
}
