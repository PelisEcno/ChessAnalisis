// Copia los builds "lite" de Stockfish (paquete npm "stockfish") a
// public/engine/, de donde Next.js los sirve como archivos estáticos para
// que el Web Worker del motor los cargue en el cliente.
//
// Se corren manualmente y se versionan en git (no en cada install): correr
// `node scripts/copy-engine-assets.mjs` desde apps/web después de actualizar
// la versión de "stockfish" en package.json.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const stockfishPkgDir = dirname(require.resolve("stockfish/package.json"));
const binDir = join(stockfishPkgDir, "bin");
const outDir = join(here, "..", "public", "engine");

mkdirSync(outDir, { recursive: true });

const FILES = [
  "stockfish-18-lite.js",
  "stockfish-18-lite.wasm",
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm",
];

for (const file of FILES) {
  copyFileSync(join(binDir, file), join(outDir, file));
  console.log(`copiado ${file}`);
}

copyFileSync(join(stockfishPkgDir, "Copying.txt"), join(outDir, "Copying.txt"));
console.log("copiado Copying.txt (licencia GPLv3 de Stockfish)");
