# GitBee (monorepo)

| App      | Dir             | Stack                    | Port |
| -------- | --------------- | ------------------------ | ---- |
| Backend  | `apps/backend`  | Express + Prisma (MySQL) | 5000 |
| Frontend | `apps/frontend` | Next.js                  | 8000 |

## Quick start (Docker, recommended)

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
pnpm dev:backend   # tsx watch on :5001 (run in a separate terminal)
pnpm dev:frontend  # next dev on :8000
```

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
