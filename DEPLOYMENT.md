# Deployment: BELAC Fun public archive

## Current topology (19 November 2026)

- Canonical repository: `Belacosaur/belac-fun`, branch `main`.
- Hosted frontend: Cloudflare Pages project `belac-fun`, documented as direct upload of `apps/web/dist`; it is separate from the Windows API service. A Git push is not proof of a Pages deployment.
- Public API hostname: `api.belac.fun`. The native Windows `BELAC-Fun-Archive` service listens privately on `127.0.0.1:18184`; its dedicated connector is `BELAC-Fun-Archive-Tunnel`.
- The live API is intentionally a **public-read-only archive**, not the general API or jobs entrypoint in this monorepo. Private reconciliation, audit and research records remain in sealed archive inputs, not in the public serving payload.
- PostgreSQL archive database: `belac_fun_archive`. Production credentials remain outside Git in protected service-specific configuration.

## Safety and release boundary

Trading, signing, execution, research/sync workers and live financial workflows remain off. Do not deploy `apps/api/src/index.ts`, `infra/start.mjs`, a Docker service role, or a historical worker onto the archive service. Keep source, schemas and historical designs for reference; they are not activation instructions. Do not run schema migrations or archive imports during ordinary startup.

The reviewed public-only native entrypoint, application and mock fixture are now versioned in apps/api/src/native-fun-archive*. The existing shared route/query/security sources match the reviewed deployed source (line endings aside). Compiled runtime byte parity and importer/release automation are not established, so **automatic Server activation remains disabled**. A successful generic monorepo build must not replace the archive.

## Build and verification

Repository tooling: Node >=22, pnpm 10.18.2, `pnpm install --frozen-lockfile`. Existing CI runs typecheck, lint and tests; it does not deploy Server services. The hosted web build is `pnpm --filter @belac/web build`. Preserve the existing production API build setting targeting `https://api.belac.fun`; do not introduce secrets into Vite variables.

A native archive release must be built from the separately reviewed public-only entrypoint, bundled with its runtime dependencies, and compared against the intended release before service activation. Validate only read-only `/health/live` and `/health/ready`; readiness reports archive mode. Verify public responses do not expose private records and that prohibited mutation routes remain unavailable. Do not perform payment/trade tests.

## Configuration and operation

Native app configuration names: `FUN_ARCHIVE_DATABASE_URL` and `FUN_ARCHIVE_ALLOWED_ORIGINS`. Legacy Access/research settings do not enable an admin surface: the deployed public-only build must remain public-only. Values and connector credentials are managed outside the repo. Do not commit `.env`, DPAPI files, tokens, snapshots, logs with payloads or signing material.

The connector must retain its exact hostname/origin, dedicated stale-port safeguard, protected permit and fresh applied-config verification. Restart/startup automation is separate from repository cleanup. Do not change its policy or route as a build step.

## Intended versus actual deployment

Intended future flow: isolated non-admin locked build -> immutable app-specific artifact -> independent archive-fence validation -> explicitly scoped activation -> read-only health proof. Actual current flow: supervised native release, no enabled GitHub-to-Server activation. Pages direct upload is separately verified by deployment identity and public content. Default-branch changes alone are not proof of either deployment.

Railway-only root configuration has been removed. AWS/Railway-era design and integration notes are historical, not current deployment guidance; use this document for the active topology.
### Reproducible public archive build (no activation)

From `apps/api`, after the frozen-lockfile install:

```sh
pnpm exec esbuild src/native-fun-archive-entry.ts --bundle --platform=node --format=esm --banner:js="import { createRequire as cr } from 'node:module'; const require=cr(import.meta.url);" --outfile=dist/native-fun-archive.mjs
pnpm exec vitest run src/native-fun-archive.test.mts
```

Do not use `--packages=external`: the Windows runtime must not depend on developer package-store junctions. Do not execute the entrypoint during tests. The fixture is in-process with a mock database; it verifies public response contracts and denial of private/mutation routes. It does not prove production parity or reboot recovery. Generated bundles and migration data are never committed.