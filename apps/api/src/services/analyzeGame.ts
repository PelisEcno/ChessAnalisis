import {
  buildGameReport,
  parsePgn,
  type EngineResult,
  type GameReport,
} from "@peon-libre/core";
import { env } from "../env.js";
import { NativeStockfishEngine } from "../engine/nativeStockfish.js";
import { redis } from "../redis.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DEFAULT_MULTIPV = 3;

function cacheKey(fen: string, depth: number): string {
  return `engine-cache:${depth}:${fen}`;
}

async function getCached(
  fen: string,
  depth: number,
): Promise<EngineResult | undefined> {
  const raw = await redis.get(cacheKey(fen, depth));
  return raw ? (JSON.parse(raw) as EngineResult) : undefined;
}

async function setCached(
  fen: string,
  depth: number,
  result: EngineResult,
): Promise<void> {
  // Sin expiración: la evaluación de una posición a una profundidad dada
  // no cambia (misma versión de motor).
  await redis.set(cacheKey(fen, depth), JSON.stringify(result));
}

/**
 * Analiza un PGN completo con Stockfish nativo, posición por posición,
 * cacheando en Redis por FEN+profundidad (las aperturas se repiten
 * muchísimo entre partidas distintas).
 */
export async function analyzeGamePgn(
  pgn: string,
  depth: number,
): Promise<GameReport> {
  const game = parsePgn(pgn);
  const fens = [
    game.positions[0]?.fenBefore ?? START_FEN,
    ...game.positions.map((p) => p.fenAfter),
  ];

  const engine = new NativeStockfishEngine("stockfish", env.STOCKFISH_THREADS);
  await engine.init();

  try {
    const results: EngineResult[] = [];
    for (const fen of fens) {
      const cached = await getCached(fen, depth);
      if (cached) {
        results.push(cached);
        continue;
      }
      const result = await engine.analyze(fen, {
        depth,
        multiPV: DEFAULT_MULTIPV,
      });
      await setCached(fen, depth, result);
      results.push(result);
    }

    return buildGameReport(game, results);
  } finally {
    engine.dispose();
  }
}
