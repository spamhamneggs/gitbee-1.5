# syntax=docker.io/docker/dockerfile:1

# Official pnpm base image (Debian slim + standalone pnpm, no Node bundled).
# It sets PNPM_HOME=/pnpm (on PATH) with the store at /pnpm/store,
# which is what the BuildKit cache mount below targets.
FROM ghcr.io/pnpm/pnpm:12 AS base
RUN pnpm runtime set node 24 -g
WORKDIR /repo

# Install the workspace and build the Next.js app.
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_BACKEND_API
ENV NEXT_PUBLIC_BACKEND_API=$NEXT_PUBLIC_BACKEND_API

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter gitbee-frontend build

# Production image, copy standalone output and run next.
# Plain Node image (not the pnpm base): the standalone server only needs
# `node`, and the pnpm-managed node shim is unreadable for the non-root
# `nextjs` user. Debian/glibc also matches the build stage (sharp binaries).
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# In a workspace the standalone server keeps repo-relative paths:
# server at apps/frontend/server.js needs .next/static + public beside it.
COPY --from=build /repo/apps/frontend/public ./apps/frontend/public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/frontend/.next/static ./apps/frontend/.next/static

USER nextjs

EXPOSE 8000

ENV PORT=8000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/frontend/server.js"]
