# syntax=docker/dockerfile:1.7
# CardPop on a VPS: one image that serves the Vite build and runs the Express
# API + the former Vercel functions through server/index.js. Built on the box
# by deploy/deploy.sh (docker compose build); runbook in docs/vultr-rollout.md.
#
# Three stages so the runtime image carries production dependencies and the
# build output only — no Vite, no Playwright, no test tree.

ARG NODE_VERSION=24

# ── deps: everything, for the build ─────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── build: the Vite bundle ───────────────────────────────────────────────────
FROM deps AS build
COPY . .
# Vite inlines VITE_* values at build time. The server's .env is mounted for
# this one step as a BuildKit secret — it is read, never copied into a layer —
# and Vite picks the VITE_* entries out of it itself, so the list of
# build-time variables doesn't have to be repeated here.
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN --mount=type=secret,id=dotenv,target=/app/.env npm run build

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    DOTENV_CONFIG_QUIET=true \
    PORT=3000 \
    HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
# What server/index.js reaches at runtime: the server, the API, the functions
# and the modules they share with the frontend, plus the routing manifest.
COPY server ./server
COPY src ./src
COPY api ./api
COPY utils ./utils
COPY data ./data
COPY config ./config
COPY lib ./lib
COPY vercel.json ./
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server/index.js"]
