# Ript pack investigation

Checked 20 October 2026 at the user's request. Read-only inspection of `D:/Dev/Belacorepo/110-pocketv2` and the deployed site's public catalog. No orders, reservations, payments, pack openings or Ript source changes.

Subsequent owner decision: Ript is pending a new custom challenge pack. The worker no longer polls this catalog. Findings below describe the earlier investigation, not an active challenge integration.

The deployed `https://ript.fun/play` JavaScript uses `https://ript-backend-production.up.railway.app`. Its `GET /opening/packs` returned:

| Pack | Price USD | Available | Status | ID |
|---|---:|---:|---|---|
| Ript $25 | 25 | 183 | available | managed-04069cef-c807-4f4d-98b0-fba9c5c72566 |
| Ript $50 | 50 | 210 | available | managed-819bc617-2455-45dd-82d0-d22522f322cc |
| Ript $100 | 100 | 192 | available | managed-d93167f5-8e3d-4664-8cef-f468831d516d |

These are catalog availability counts at observation time, not completed purchase verification. Full public response: `artifacts/ript-pack-catalog-20261020.json`.

The response's chain is `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, independently matched to Solana devnet's `getGenesisHash`. It uses payment token `8v9brXcEVXcuHpnEZqQSq4YCoyQ8TvNepcqvr9k9GawY`, `purchaseMode=atomic-ownership` and `stickerRedemptionMode=sponsor-only`. This is not verified mainnet USDC purchasing.

The original allocation is $10 for this station. No available catalog pack fits even one purchase within that allocation. Pack choice, challenge pricing and network configuration remain unresolved. No weekly scheduler has been created.

## Integration findings

- `backend/src/routes/opening-orders.ts` exposes the public catalog and wallet-authorized order/history routes. The current local source has older fixed pack IDs; the deployed catalog uses managed IDs. Do not build purchasing against those stale local enums without reconciling deployed source.
- `GET /opening/orders?wallet=...` is guarded by the route's authorization callback. Platform ownership does not remove the wallet/session authorization requirement. A scoped read integration is still needed for collected cards, paid costs and proceeds.
- The older `GET /packs` returns 404 on this deployment. Use the verified catalog endpoint.
- The local `PlayPage.tsx` is a separate game/session flow calling `/api/play/config` and `/api/play/catalog`; both returned 404 on `ript.fun` during this check. The available packs above are from the working opening catalog, not a verified Play session.
- `open-packs-restoration-2026-10-02.md` records earlier managed-pack restoration; static JSON and legacy `live-gacha-packs.ts` prices are not current availability evidence.
- Station nine reads catalog health/availability only. Its observed value and position count stay unknown; expected card value and catalog inventory are never used as challenge returns.
- Branding comes from `frontend/public/Ripticon1024.png` and `frontend/src/lib/brand-catalog.ts`. The deployed CSS confirms orange `#ff7a1a`, black `#05070a` and cream `#f4f1ec`.

Execution remains disabled. Ript implementation details are documented here to support later read-only reconciliation.
