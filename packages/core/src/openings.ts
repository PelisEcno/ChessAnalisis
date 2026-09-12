import ecoIndex from "../data/eco.json";

export interface OpeningMatch {
  eco: string;
  name: string;
  /** Último ply (1-indexado) que todavía está en libro. */
  lastBookPly: number;
}

interface EcoEntry {
  eco: string;
  name: string;
  ply: number;
}

const INDEX = ecoIndex as Record<string, EcoEntry>;

/** Quita halfmove clock y fullmove number: al libro de aperturas no le importan. */
function normalizeFen(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/**
 * Dada la lista de FEN de una partida (una por ply, FEN DESPUÉS de cada
 * jugada), devuelve la apertura más profunda que matchea en el índice ECO y
 * en qué ply se salió de teoría. `undefined` si ni la posición inicial está
 * en el dataset (no debería pasar: toda apertura conocida empieza en libro).
 */
export function detectOpening(fens: string[]): OpeningMatch | undefined {
  let match: OpeningMatch | undefined;

  for (let ply = 0; ply < fens.length; ply++) {
    const fen = fens[ply];
    if (fen === undefined) break;
    const entry = INDEX[normalizeFen(fen)];
    if (!entry) break; // en cuanto una posición no está en libro, se salió de teoría
    match = { eco: entry.eco, name: entry.name, lastBookPly: ply + 1 };
  }

  return match;
}
