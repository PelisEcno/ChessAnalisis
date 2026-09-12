import { Chess } from "chess.js";

/** Convierte una variante en UCI a SAN legible, jugando cada movida en orden. */
export function uciPvToSan(fen: string, pv: string[]): string[] {
  const chess = new Chess(fen);
  const sans: string[] = [];
  for (const uci of pv) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.slice(4) || undefined;
    try {
      const move = chess.move({ from, to, promotion });
      sans.push(move.san);
    } catch {
      break; // variante ilegal a partir de acá (no debería pasar, pero no rompemos la UI)
    }
  }
  return sans;
}
