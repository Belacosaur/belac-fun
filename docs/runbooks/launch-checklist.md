# Launch checklist

Do not point belac.fun at this app until ADR-009 providers are signed and ADR-003 and ADR-004 are approved.

1. Set `APP_ENV`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `SESSION_SECRET`, and `AUTH_MODE=access` with `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`.
2. Keep `ALLOW_ILLUSTRATIVE` unset or false. Production boot rejects `true`.
3. Apply `packages/db` migrations in filename order, then refuse the seed because `APP_ENV=production`.
4. Check `GET /health/ready` returns 200 only when `select 1` succeeds.
5. Confirm Cloudflare Access sits in front of `/admin` and `/v1/admin`.
6. Confirm admin responses stay `Cache-Control: private, no-store`.
7. Stop if any public payload for real campaigns has `isIllustrative: true`.
