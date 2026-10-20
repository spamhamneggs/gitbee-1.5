# GitBee (monorepo)

| App      | Dir             | Stack                    | Port |
| -------- | --------------- | ------------------------ | ---- |
| Backend  | `apps/backend`  | Express + Prisma (MySQL) | 5000 |
| Frontend | `apps/frontend` | Next.js                  | 8000 |

## Quick start (Docker, recommended)

For an existing database, complete the baseline steps below before starting the backend.

```bash
# create the shared env once
cp .env.example .env
pnpm env:sync

# first boot only; seed the fresh DB (seed wipes tables, never runs by default)
SEED_ON_BOOT=true docker compose up --build
# normal boots
docker compose up
```

- Frontend is on <http://localhost:8000>
- Backend is on <http://localhost:5001/api/> (host port 5001, macOS AirPlay usually squats on 5000).

## Local dev (host servers, Docker MySQL)

The app servers run on the host, but MySQL still comes from Docker:

```bash
docker compose up mysql   # database `gitbee` on :3306
cp .env.example .env
pnpm env:sync
pnpm install
pnpm --filter gitbee_backend exec prisma migrate deploy --config ./api/prisma.config.ts
pnpm dev:backend   # tsx watch on :5001 (run in a separate terminal)
pnpm dev:frontend  # next dev on :8000
```

## Database migrations

Docker startup runs `prisma migrate deploy`. The `0_init` migration captures the
complete schema previously managed with `prisma db push` and replaces the partial
`20241007122240_project_table` migration. Fresh databases apply it normally.

For each existing database created with `db push`, point `apps/backend/.env` at
that database and run these commands once from the repository root, before
starting the backend:

```bash
docker compose up -d mysql  # when using the local Docker database
# Must report no difference (exit code 0) before resolving the baseline.
pnpm --filter gitbee_backend exec prisma migrate diff --from-config-datasource --to-schema ./api/prisma/schema.prisma --config ./api/prisma.config.ts --exit-code
pnpm --filter gitbee_backend exec prisma migrate resolve --applied 0_init --config ./api/prisma.config.ts
pnpm --filter gitbee_backend exec prisma migrate status --config ./api/prisma.config.ts
```

`resolve --applied` records the baseline without executing its SQL or changing
application data. If the diff reports changes, reconcile them before resolving;
do not reset or seed a database whose data must be preserved.

The baseline was generated with Prisma 7's `--to-schema` option:

```bash
pnpm --filter gitbee_backend exec prisma migrate diff --from-empty --to-schema ./api/prisma/schema.prisma --config ./api/prisma.config.ts --script --output ./api/prisma/migrations/0_init/migration.sql
```

For future schema changes, create a migration with
`pnpm --filter gitbee_backend exec prisma migrate dev --name <name> --config ./api/prisma.config.ts`
against a development database. Commit its SQL and deploy with `prisma migrate deploy`.

## Env wiring

Use the root `.env` as the shared source of truth for this monorepo.

- Run `pnpm env:sync` after changing the root `.env`.
- The script generates `apps/backend/.env` and `apps/frontend/.env.local`.
- Backend CORS trusts `WEB_URL`.
- Frontend calls `${NEXT_PUBLIC_BACKEND_API}…`; the trailing slash is required.
- `NEXT_PUBLIC_*` values are baked in at frontend build time, so rebuild the frontend image after changing them for Docker.

### Shared variables

The root `.env.example` includes the shared settings for the full stack:

- database: `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_PORT`
- backend: `BACKEND_PORT`, `BACKEND_CONTAINER_PORT`, `DATABASE_URL`, `DATABASE_URL_DOCKER`, `WEB_URL`, `JWT_SECRET`, `COOKIE_NAME`, `BLUEJACK_API`, `ATLANTIS_API`
- frontend: `FRONTEND_PORT`, `NEXT_PUBLIC_BACKEND_API`, `NEXT_PUBLIC_CLIENT_ID`, `NEXT_PUBLIC_TENANT_ID`, `NEXT_PUBLIC_REDIRECT_URI`, `NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI`, `NEXT_PUBLIC_STORE_AUTH_STATE_IN_COOKIE`, `NEXT_PUBLIC_CACHE_LOCATION`
- docker behavior: `SEED_ON_BOOT`

### Notes on app-specific env files

- `apps/backend/.env.example` now lists every backend variable currently used in code.
- `apps/frontend/.env.example` matches the public variables used by the MSAL and API client setup.
- `NEXT_PUBLIC_TENANT_ID` is used as the MSAL `authority`, so it should contain the full Microsoft authority URL, not only a raw tenant id.

## Notes

- One `pnpm install` at root (pnpm workspaces, `pnpm-workspace.yaml`). Single
  `pnpm-lock.yaml`; new clones must run `pnpm install` locally too, or the
  backend dev volume mount hides the image's dependencies.
- `apps/backend/docker-compose.yml` was removed; the root `docker-compose.yml` owns local orchestration.
- Never run the backend seed against a real database, it deletes all rows first.

## Acknowledgements

This monorepo combines and extends two earlier projects by Timothy Darren, Kelson, and Nicholas Chandra:

- [Aliux7/gitbee](https://github.com/Aliux7/gitbee) (frontend)
- [darrzx/gitbee-backend](https://github.com/darrzx/gitbee-backend) (backend)
