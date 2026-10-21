# Infrastructure

The existing Railway project `belac-fun` (`6e3aacfe-a828-4316-8f17-89ae4417fab6`) now hosts:

- `belac-fun`: public Fastify API; reads persisted snapshots.
- `sync-worker`: private background service; reads Solana and supported platform APIs every 60 seconds.
- `execution-worker`: private Meteora unsigned preparation and read-only receipt recovery; server execution explicitly disabled. Owner signing/submission happens in the frontend wallet. See [execution-service.md](../docs/integrations/execution-service.md).
- `Postgres`: shared persistence over Railway private networking.

See [live-data.md](../docs/integrations/live-data.md) for deployment, coverage and operating details.

## Response headers

Public static files should send:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` allowing the API origin plus embed hosts `https://www.youtube.com`, `https://www.youtube-nocookie.com`, `https://www.tiktok.com`, and `https://x.com` in `frame-src` only.

Admin API responses stay `Cache-Control: private, no-store`.

See `apps/web/public/_headers` for the Pages header file. This backend rollout updates Railway and the local studio; it does not publish a new Cloudflare Pages frontend release.

## Research service

`research-worker` is the fifth service in the existing project (API, wallet sync, research, disabled execution and Postgres). Set `SERVICE_ROLE=research-worker`, `EXECUTION_ENABLED=false`, the public wallet address and a private Postgres reference. No public domain or signing credentials. See [research worker](../docs/integrations/research-worker.md) for cadence, reports and dry-run commands.
