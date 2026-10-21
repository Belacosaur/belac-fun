# Transaction preparation service

Current scope, 21 October 2026: the existing service prepares unsigned Meteora entry transactions and reconciles user-submitted signatures. Financial execution remains disabled on the server. The owner signs and submits from the frontend wallet. See [Meteora wallet flow](meteora-wallet-flow.md).

## Railway configuration

- Project: `belac-fun` / `6e3aacfe-a828-4316-8f17-89ae4417fab6`
- Service: `execution-worker` / `06d4455b-3a4f-42a8-94fa-bd0ceafa099a`
- Environment: production
- Variables: `SERVICE_ROLE=execution-worker`, `EXECUTION_ENABLED=false`, `METEORA_PREPARATION_ENABLED=true`, `APP_ENV=production`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- Private endpoints: `GET /health/live`, `GET /health/ready`, `GET /execution/status`
- No public domain or signing credentials.

Readiness checks Postgres. Status reports `enabled:false`, no server signing or submission, and separate preparation capabilities limited to station 5. Financial job claiming stays disabled; the preparation queue handles only unsigned building/simulation and read-only receipt recovery.

## Implementation

- Add a separate `execution-worker` entry point using the existing jobs package and root Docker image.
- Set `EXECUTION_ENABLED=false` explicitly. Missing flags default to disabled; unsupported enabled or malformed values fail startup.
- Provide private liveness, database readiness and execution-status endpoints. Preparation may quote, build and simulate but never load an owner signer or submit transactions.
- Connect to existing Postgres over private networking; migration 0009 stores authentication, reservations, attempts and receipts. No public worker domain is needed.
- Test disabled defaults, rejection of accidental activation, readiness failures and rejection of action requests. Deploy only this service and verify its private endpoints.

## Owner wallet handoff

The service never needs spending credentials. The flow is:

1. Owner connects and authenticates the existing challenge wallet in the frontend.
2. Owner requests a fresh bounded Meteora preparation.
3. Worker returns a validated, simulated unsigned message.
4. Owner explicitly signs in the wallet; the frontend registers the signature and submits.
5. Worker verifies the finalized receipt; sync updates position tracking and separate operating costs.

Changing `EXECUTION_ENABLED` cannot activate this build. The service rejects enabled mode. No funding-triggered execution or server broadcast path exists. Other stations remain outside this preparation flow.

## Verification

Eight execution-service tests cover disabled defaults, accidental activation, rejected action requests, database isolation and readiness failures. The eight live-sync regression tests also pass. Jobs typechecking and repository lint pass. The deployment's private endpoints and configuration are verified after Railway reports success.
