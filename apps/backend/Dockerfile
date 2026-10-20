# syntax=docker.io/docker/dockerfile:1

# Official pnpm base image (Debian slim + standalone pnpm, no Node bundled).
# It sets PNPM_HOME=/pnpm (on PATH) with the store at /pnpm/store,
# which is what the BuildKit cache mounts below target.
FROM ghcr.io/pnpm/pnpm:12 AS base
RUN pnpm runtime set node 24 -g
WORKDIR /repo

# Full workspace install + backend build. Also the compose dev target:
# it holds the source and devDependencies, so `prisma` and `pnpm dev` work here.
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter gitbee_backend exec prisma generate --config ./api/prisma.config.ts
RUN pnpm --filter gitbee_backend build

# Production-only dependencies for the final image.
FROM base AS prod-deps
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# Minimal production runtime: prod node_modules + compiled output + Prisma
# schema and migration history. No source, no devDependencies.
FROM base AS runner
WORKDIR /repo
COPY --from=prod-deps /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=prod-deps /repo/apps/backend/package.json ./apps/backend/package.json
COPY --from=prod-deps /repo/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build /repo/apps/backend/api/prisma ./apps/backend/api/prisma

EXPOSE 5000
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "gitbee_backend", "start"]
