# apps/api

Backend con Fastify + TypeScript: cuentas, ingesta de partidas y análisis
con Stockfish nativo (a diferencia de `apps/web`, que usa la build WASM en
el navegador).

## Arquitectura

- **Postgres + Drizzle ORM** (`src/db/schema.ts`): `users`, `linked_accounts`,
  `games` (global, deduplicada por `source`+`source_id`), `analyses`
  (deduplicada por `game_id`+`engine_version`+`depth`), `move_labels`
  (desglose normalizado para consultas agregadas), `user_stats`.
- **Redis**: cachea el análisis del motor por FEN+profundidad, y es el
  backend de las colas de BullMQ.
- **Colas (BullMQ)**:
  - `ingest`: trae las partidas recientes de un usuario desde Chess.com o
    Lichess, las guarda (deduplicadas) y encola el análisis de las nuevas.
  - `analysis`: analiza una partida con Stockfish nativo (`src/engine/`,
    hablado por stdin/stdout en UCI, mismo protocolo que la build WASM de
    `apps/web`) y guarda el reporte completo (`packages/core`'s
    `GameReport`) en `analyses` + `move_labels`.
- **Auth**: magic link por email (sin proveedor real configurado: en dev el
  email se imprime en el log del servidor, ver `src/auth/email.ts`) y OAuth2
  de Google (deshabilitado si no hay `GOOGLE_CLIENT_ID`/`SECRET`). Sesiones
  con cookie httpOnly firmada, guardadas en Redis.
- **Rate limiting**: por usuario si hay sesión, si no por IP.

## Desarrollo local

```bash
cp .env.example .env   # completar SESSION_SECRET (openssl rand -hex 32) y CONTACT_EMAIL
docker compose up -d postgres redis   # desde la raíz del repo
pnpm db:migrate
pnpm dev
```

## Con Docker (api + postgres + redis completo)

Desde la raíz del repo:

```bash
docker compose up --build
```

Nota sobre el puerto de Postgres: si ya tenés otro Postgres corriendo en el
5432 local, `docker-compose.yml` publica este en el **5433** del host (el
contenedor `api` igual le habla por el 5432 interno de la red de Docker).

`packages/core` se distribuye como TypeScript sin compilar a propósito (así
`apps/web` lo transpila con su propio bundler). Como Node no puede ejecutar
`.ts` directo, esta API corre con `tsx` tanto en dev como en el contenedor
(no hay paso de `tsc` en la imagen final).

## Variables de entorno

Ver `.env.example`. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` son opcionales:
sin ellos, `/auth/google` queda deshabilitado y se loguea un aviso al
arrancar.

## Endpoints

- `POST /auth/magic-link` `{ email }` — manda (en dev, loguea) el enlace.
- `GET /auth/magic-link/callback?token=...` — completa el login, redirige a `WEB_ORIGIN`.
- `GET /auth/google` / `GET /auth/google/callback` — login con Google.
- `POST /auth/logout`
- `GET /me` — usuario autenticado + cuentas vinculadas.
- `POST /import/:platform/:username?limit=20` — vincula la cuenta y encola la ingesta.
- `GET /games` — partidas del usuario autenticado (por sus cuentas vinculadas).
- `GET /games/:id/report` — reporte de análisis (`202` con `{status:"pending"}` si todavía no terminó).
- `GET /stats` — estadísticas agregadas (el cálculo real es de la fase 6).
