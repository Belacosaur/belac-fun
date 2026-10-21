/** Research review is distinct from transaction readiness. */
export const ENTRY_PROPOSALS = [
 {id:1,provider:"Jupiter Swap",title:"SOL buy & hold",mode:"entry",detail:"Buy up to 10 USDC of SOL, held as WSOL. No timing edge established; exposure to SOL price and swap slippage."},
 {id:2,provider:"Raydium",title:"Active spot trading",mode:"proposal",detail:"WAIT: no qualifying candidate in the latest scan. Draft: trade liquid, established tokens only after liquidity, holder/security checks and an explicit entry/exit rule. No transaction prepared."},
 {id:3,provider:"Jupiter Perps",title:"Leveraged long",mode:"proposal",detail:"WAIT: no qualifying long entry. Draft requires a selected market, leverage, collateral, liquidation buffer, funding estimate and stop/exit rule. No transaction prepared."},
 {id:4,provider:"Pacifica",title:"Leveraged short",mode:"proposal",detail:"WAIT: no qualifying short entry. Draft requires a selected market, leverage, liquidation buffer, funding estimate and stop/exit rule. No transaction prepared."},
 {id:5,provider:"Meteora",title:"SOL/USDC DAMM v2",mode:"active",detail:"Existing owner-signed position. Kept active; this queue cannot create a second entry."},
 {id:6,provider:"Kamino",title:"Direct USDC lending",mode:"entry",detail:"Up to 10 USDC in the reviewed lending reserve. Variable yield, USDC depeg, protocol and withdrawal-liquidity risks. No looping or borrowing."},
 {id:7,provider:"Pump.fun",title:"Existing memecoin",mode:"paused",detail:"Paused at your request. No transaction prepared."},
 {id:8,provider:"Orca",title:"SOL/USDC concentrated liquidity",mode:"entry",detail:"Up to 10 USDC total, including SOL acquisition; refreshed ±20% range. Impermanent loss, out-of-range inactivity and protocol risk; fees are not guaranteed."},
 {id:9,provider:"Ript",title:"Weekly pack",mode:"pending",detail:"Pending your custom challenge pack. No transaction prepared."},
 {id:10,provider:"Pump.fun",title:"Launch our memecoin",mode:"paused",detail:"Paused at your request. No transaction prepared."},
] as const;
export const ENTRY_RESEARCH = {runId:"8c28753d-edc3-4f4e-b6a3-8731f1236a7a",sources:59,failedSources:0,at:"2026-10-21",note:"Research shortlist is not proof of a profitable strategy. Fresh quotes and simulations are required per approval."};
