# GitBee (monorepo)

| App      | Dir             | Stack                    | Port |
| -------- | --------------- | ------------------------ | ---- |
| Backend  | `apps/backend`  | Express + Prisma (MySQL) | 5000 |
| Frontend | `apps/frontend` | Next.js 14               | 8000 |

## Quick start (Docker, recommended)

```bash
# first boot only; seed the fresh DB (seed wipes tables, never runs by default)
SEED_ON_BOOT=true docker compose up --build
# normal boots
docker compose up
```

- Frontend is on <http://localhost:8000>
- Backend is on <http://localhost:5001/api/> (host port 5001, macOS AirPlay usually squats on 5000).

## Local dev (no Docker)

Needs MySQL on 3306 with database `gitbee`, plus per-app env files:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
pnpm install
pnpm dev:backend   # nodemon on :5000
pnpm dev:frontend  # next dev on :8000
```

## Env wiring

Backend CORS trusts `WEB_URL`; frontend calls `${NEXT_PUBLIC_BACKEND_API}…` (trailing slash required).
`NEXT_PUBLIC_*` values are baked in at frontend build time, rebuild the image after changing them.

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
