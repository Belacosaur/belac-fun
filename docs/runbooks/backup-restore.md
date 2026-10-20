# Backup and restore

Recommended objectives, pending operator acceptance: recovery point 24 hours, recovery time 8 hours.

## Local drill

From the repository root, with the compose Postgres running:

```text
docker compose exec -T postgres pg_dump -U belac belac > backup.sql
docker compose exec -T postgres psql -U belac -d belac -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
Get-Content backup.sql | docker compose exec -T postgres psql -U belac -d belac
```

Host port 5432 is owned by Windows Postgres, so the drill ran inside the compose container on 20 October 2026:

```text
docker exec 013-belacfun-postgres-1 pg_dump -U belac belac -f /tmp/belac-drill.sql
docker exec 013-belacfun-postgres-1 psql -U belac -d postgres -c "CREATE DATABASE belac_restore;"
docker exec 013-belacfun-postgres-1 psql -U belac -d belac_restore -f /tmp/belac-drill.sql
docker exec 013-belacfun-postgres-1 psql -U belac -d belac_restore -c "SELECT count(*) FROM campaigns;"
```

The restored database `belac_restore` returned one campaign row. The live `belac` database was not dropped.

## Railway PITR

Do not run these until a Railway project is approved:

1. Confirm point-in-time recovery is enabled on the Railway Postgres service.
2. Choose a timestamp before the bad write.
3. Restore to a new service, not over the live primary.
4. Point a staging API at the restored URL and check `/health/ready` plus one campaign read.
5. Promote only after the operator accepts the data.
