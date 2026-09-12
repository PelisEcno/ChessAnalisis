# Fuente de datos ECO

Archivos `a.tsv`..`e.tsv` descargados de
https://github.com/lichess-org/chess-openings (rama `master`), licencia CC0-1.0
(dominio público).

`scripts/generate-eco.mjs` los procesa y genera `../eco.json`, que es lo que
consume `src/openings.ts` en tiempo de ejecución.

Para actualizar el dataset: volver a descargar los 5 archivos desde ese repo y
correr `node scripts/generate-eco.mjs` desde `packages/core`.
