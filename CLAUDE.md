# Proyecto: analizador de partidas de ajedrez

## Reglas de trabajo

- TypeScript strict. Nada de `any` sin comentario justificando.
- `packages/core` NO puede importar React, Next, Expo ni APIs de navegador ni de Node.
  Debe ser ejecutable en ambos entornos. Toda la lógica de ajedrez vive aquí.
- Cada función pública de `core` lleva test en Vitest. Sin test, no está terminada.
- No inventes endpoints ni firmas de API. Si no estás seguro de un endpoint de
  Chess.com o Lichess, para y pregúntame en vez de adivinar.
- Commits pequeños y descriptivos (conventional commits).
- Antes de instalar una dependencia nueva, pregunta.

## Reglas de producto

- La app NO está afiliada a Chess.com ni a Lichess. Nunca usar sus logos, marcas,
  sets de piezas ni sonidos. Todo asset debe ser propio o de licencia libre.
- Stockfish es GPLv3: mantener el aviso de licencia y el enlace al código fuente en la app.
- Los textos de la UI son en español por defecto, con i18n preparado para inglés.

## Comandos

- `pnpm dev` — levanta la web
- `pnpm test` — corre todos los tests
- `pnpm typecheck` — verifica tipos en todo el monorepo
