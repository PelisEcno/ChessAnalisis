# syntax=docker/dockerfile:1
#
# Build multi-etapa para @peon-libre/api, usando `turbo prune` para aislar
# del monorepo justo lo que este paquete necesita (él mismo + packages/core).
# Corre desde la raíz del repo: docker build -f apps/api/Dockerfile .
#
# packages/core se distribuye como TypeScript sin compilar (a propósito:
# así apps/web lo transpila con su propio bundler). Node no puede ejecutar
# .ts directo, así que en vez de agregarle un paso de build a core solo para
# este backend, la API corre con tsx (ya es su devDependency) tanto en dev
# como acá en el contenedor.

FROM node:20-bookworm-slim AS base
RUN corepack enable

# 1. Podar el monorepo a solo @peon-libre/api y sus dependencias internas.
FROM base AS pruner
WORKDIR /repo
COPY . .
RUN npx turbo prune @peon-libre/api --docker

# 2. Instalar dependencias (incluye devDependencies: tsx corre en runtime).
FROM base AS installer
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .

# 3. Imagen final: Node + Stockfish nativo (GPLv3, ver /licencias en la web).
FROM node:20-bookworm-slim AS runtime
RUN corepack enable \
    && apt-get update \
    && apt-get install -y --no-install-recommends stockfish ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
# Debian instala stockfish en /usr/games (categoría "games" del paquete),
# que no está en el PATH por defecto de una shell no interactiva.
ENV PATH="/usr/games:${PATH}"
COPY --from=installer /repo .

EXPOSE 4000
# Se invoca el binario de tsx directo (no "pnpm run start"): pnpm revalida
# el estado del workspace en cada "run" y termina reinstalando en cada
# arranque del contenedor, que es lento y no hace falta (ya se instaló en
# el paso "installer").
CMD ["apps/api/node_modules/.bin/tsx", "apps/api/src/index.ts"]
