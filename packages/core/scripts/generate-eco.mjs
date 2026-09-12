// Convierte los TSV de lichess-org/chess-openings (data/eco/*.tsv) a un único
// data/eco.json indexado por FEN normalizado, que es lo que openings.ts carga
// en tiempo de ejecución. Correr con: node scripts/generate-eco.mjs
import { Chess } from "chess.js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ecoDir = join(here, "..", "data", "eco");
const outFile = join(here, "..", "data", "eco.json");

const FILES = ["a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"];

function normalizeFen(fen) {
  // "posición" sin contadores de jugadas: placement/turn/castling/ep, sin
  // halfmove clock ni fullmove number.
  return fen.split(" ").slice(0, 4).join(" ");
}

const index = {};
let total = 0;
let collisions = 0;

for (const file of FILES) {
  const text = readFileSync(join(ecoDir, file), "utf8");
  const lines = text.split("\n").slice(1); // descarta el header eco\tname\tpgn

  for (const line of lines) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split("\t");
    if (!eco || !name || !pgn) continue;

    const chess = new Chess();
    chess.loadPgn(pgn.trim());
    const ply = chess.history().length;
    const key = normalizeFen(chess.fen());

    total += 1;
    if (index[key] && index[key].ply >= ply) {
      collisions += 1;
      continue;
    }
    index[key] = { eco, name, ply };
  }
}

writeFileSync(outFile, JSON.stringify(index));
console.log(
  `${Object.keys(index).length} posiciones indexadas de ${total} líneas (${collisions} colisiones de FEN descartadas).`,
);
