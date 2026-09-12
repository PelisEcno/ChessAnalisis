import { Chess } from "chess.js";
import type { PieceSymbol } from "chess.js";
import {
  bestLineForMover,
  classifyMove,
  hasMissedWin,
  type MoveContext,
  type MoveLabel,
} from "./classify.js";
import {
  cpForMover,
  evalToWinPercent,
  gameAccuracy,
  moveAccuracy,
  winPercentForMover,
} from "./eval.js";
import { detectOpening, type OpeningMatch } from "./openings.js";
import type { ParsedGame, ParsedGameHeaders } from "./pgn.js";
import type { Color } from "./types.js";

export type GamePhase = "opening" | "middlegame" | "endgame";

export interface AnnotatedMove {
  ply: number;
  moveNumber: number;
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  phase: GamePhase;
  label: MoveLabel;
  missedWin: boolean;
  /** Precisión de la jugada (0-100), ver moveAccuracy en eval.ts. */
  accuracy: number;
  /** Win% (perspectiva de quien mueve) perdido respecto a la mejor jugada disponible. */
  deltaWin: number;
  /** Centipawns (perspectiva de quien mueve) perdidos respecto a la mejor jugada disponible. */
  cpLoss: number;
  clockSeconds: number | undefined;
}

export interface PhaseBreakdown {
  opening: number;
  middlegame: number;
  endgame: number;
}

export interface PlayerReport {
  accuracy: number;
  labelCounts: Record<MoveLabel, number>;
  bestMove: AnnotatedMove | undefined;
  worstMove: AnnotatedMove | undefined;
  /** ACPL (centipawn loss promedio) por fase de la partida. */
  acplByPhase: PhaseBreakdown;
}

export interface GameReport {
  headers: ParsedGameHeaders;
  opening: OpeningMatch | undefined;
  moves: AnnotatedMove[];
  /** Win% (perspectiva de blancas) tras cada ply, para graficar. */
  evalGraph: number[];
  players: { w: PlayerReport; b: PlayerReport };
  /** Las 3 jugadas con mayor ΔWin de toda la partida (sin contar libro). */
  criticalMoments: AnnotatedMove[];
}

function emptyLabelCounts(): Record<MoveLabel, number> {
  return {
    book: 0,
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    missed_win: 0,
  };
}

// Valores de material estándar; los peones y reyes no cuentan para decidir
// la fase de la partida (una posición sin damas ni piezas menores es final
// aunque conserve todos los peones).
const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 0,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};
const STARTING_NON_PAWN_MATERIAL = 2 * (2 * 3 + 2 * 3 + 2 * 5 + 9); // 62
const ENDGAME_MATERIAL_THRESHOLD = 26;
const OPENING_MATERIAL_TOLERANCE = 6;

function nonPawnMaterial(fen: string): number {
  let total = 0;
  for (const row of new Chess(fen).board()) {
    for (const square of row) {
      if (square) total += PIECE_VALUES[square.type];
    }
  }
  return total;
}

/**
 * Fase de la partida según el material que queda en el tablero, no según el
 * número de jugada: un gambito que cambia piezas temprano puede entrar en
 * "middlegame" antes que una apertura cerrada y lenta.
 */
export function gamePhase(fen: string): GamePhase {
  const material = nonPawnMaterial(fen);
  if (material <= ENDGAME_MATERIAL_THRESHOLD) return "endgame";
  if (material >= STARTING_NON_PAWN_MATERIAL - OPENING_MATERIAL_TOLERANCE) {
    return "opening";
  }
  return "middlegame";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function acplByPhase(moves: AnnotatedMove[]): PhaseBreakdown {
  const buckets: Record<GamePhase, number[]> = {
    opening: [],
    middlegame: [],
    endgame: [],
  };
  for (const move of moves) buckets[move.phase].push(move.cpLoss);
  return {
    opening: average(buckets.opening),
    middlegame: average(buckets.middlegame),
    endgame: average(buckets.endgame),
  };
}

function buildPlayerReport(moves: AnnotatedMove[], color: Color): PlayerReport {
  const ownMoves = moves.filter((m) => m.color === color);
  const labelCounts = emptyLabelCounts();
  for (const move of ownMoves) labelCounts[move.label] += 1;

  const accuracy = gameAccuracy(ownMoves.map((m) => m.accuracy));

  // El libro de aperturas es teoría memorizada, no una elección del jugador
  // en esa partida: no cuenta para "mejor"/"peor" jugada.
  const playedMoves = ownMoves.filter((m) => m.label !== "book");
  const bestMove = playedMoves.length
    ? playedMoves.reduce((a, b) => (b.deltaWin < a.deltaWin ? b : a))
    : undefined;
  const worstMove = playedMoves.length
    ? playedMoves.reduce((a, b) => (b.deltaWin > a.deltaWin ? b : a))
    : undefined;

  return {
    accuracy,
    labelCounts,
    bestMove,
    worstMove,
    acplByPhase: acplByPhase(ownMoves),
  };
}

/**
 * Arma el reporte completo de una partida ya parseada (pgn.ts) y analizada
 * por el motor (un MoveContext por ply, en el mismo orden que
 * `game.positions`, con las líneas de motor y la evaluación resultante de
 * cada jugada).
 */
export function buildReport(
  game: ParsedGame,
  analyzedPositions: MoveContext[],
): GameReport {
  const opening = detectOpening(game.positions.map((p) => p.fenAfter));

  const moves: AnnotatedMove[] = game.positions.map((position, i) => {
    const ctx = analyzedPositions[i];
    if (!ctx) {
      throw new Error(
        `Falta el análisis del motor para el ply ${position.ply}`,
      );
    }

    const label = classifyMove(ctx);
    const bestLine = bestLineForMover(ctx.engineLines, position.color);

    const winBefore = bestLine
      ? winPercentForMover(bestLine.eval, position.color)
      : winPercentForMover(ctx.evalAfter, position.color);
    const winAfter = winPercentForMover(ctx.evalAfter, position.color);
    const deltaWin = Math.max(0, winBefore - winAfter);

    const cpBefore = bestLine
      ? cpForMover(bestLine.eval, position.color)
      : cpForMover(ctx.evalAfter, position.color);
    const cpAfter = cpForMover(ctx.evalAfter, position.color);
    const cpLoss = Math.max(0, cpBefore - cpAfter);

    return {
      ply: position.ply,
      moveNumber: position.moveNumber,
      color: position.color,
      san: position.san,
      uci: position.uci,
      fenBefore: position.fenBefore,
      fenAfter: position.fenAfter,
      phase: gamePhase(position.fenBefore),
      label,
      missedWin: hasMissedWin(ctx),
      accuracy: moveAccuracy(winBefore, winAfter),
      deltaWin,
      cpLoss,
      clockSeconds: position.clockSeconds,
    };
  });

  const evalGraph = analyzedPositions.map((ctx) =>
    evalToWinPercent(ctx.evalAfter),
  );

  const criticalMoments = moves
    .filter((m) => m.label !== "book")
    .slice()
    .sort((a, b) => b.deltaWin - a.deltaWin)
    .slice(0, 3);

  return {
    headers: game.headers,
    opening,
    moves,
    evalGraph,
    players: {
      w: buildPlayerReport(moves, "w"),
      b: buildPlayerReport(moves, "b"),
    },
    criticalMoments,
  };
}
