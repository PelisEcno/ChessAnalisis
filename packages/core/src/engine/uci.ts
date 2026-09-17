import type { EngineLineResult } from "./types.js";

/**
 * Parsea una línea "info" de la salida UCI de Stockfish a EngineLineResult.
 * Común a cualquier backend (WASM en el navegador, nativo en el servidor):
 * el protocolo UCI es el mismo en los dos casos.
 */
export function parseUciInfoLine(line: string): EngineLineResult | null {
  // Solo nos interesan las líneas "info" que traen una variante calculada
  // (multipv + pv); el resto ("info string ...", progreso, etc.) se ignora.
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;

  const depthMatch = /\bdepth (\d+)/.exec(line);
  const multipvMatch = /\bmultipv (\d+)/.exec(line);
  const cpMatch = /\bscore cp (-?\d+)/.exec(line);
  const mateMatch = /\bscore mate (-?\d+)/.exec(line);
  const pvMatch = / pv (.+)$/.exec(line);

  if (!depthMatch || !multipvMatch || !pvMatch) return null;

  return {
    depth: Number(depthMatch[1]),
    multipv: Number(multipvMatch[1]),
    scoreCp: cpMatch ? Number(cpMatch[1]) : undefined,
    mateIn: mateMatch ? Number(mateMatch[1]) : undefined,
    pv: pvMatch[1]!.trim().split(/\s+/),
  };
}
