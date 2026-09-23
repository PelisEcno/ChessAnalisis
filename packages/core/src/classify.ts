import { Chess } from "chess.js";
import type { PieceSymbol, Square } from "chess.js";
import { winPercentForMover } from "./eval.js";
import { THRESHOLDS } from "./thresholds.js";
import type { Color, Eval } from "./types.js";

export type MoveLabel =
  | "book"
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "missed_win";

export interface EngineLine {
  /** Evaluación de esta línea, perspectiva de blancas. */
  eval: Eval;
  /** Jugadas en UCI de la variante principal; pv[0] es la recomendada por el motor. */
  pv: string[];
}

export interface MoveContext {
  fenBefore: string;
  fenAfter: string;
  color: Color;
  /** Jugada jugada, en UCI (p.ej. "e2e4", "e7e8q"). */
  uci: string;
  /** Mejores líneas del motor ANTES de la jugada (MultiPV >= 3), en cualquier orden. */
  engineLines: EngineLine[];
  /** Evaluación real de la posición resultante tras la jugada jugada. */
  evalAfter: Eval;
  /** Si la posición seguía en libro de aperturas antes de esta jugada. */
  inBook: boolean;
  /**
   * Si esta jugada es una simple recaptura en la casilla donde el rival
   * acaba de capturar. classify.ts solo ve una jugada a la vez, así que
   * quien arma el MoveContext recorriendo la partida en orden (report.ts)
   * debe indicarlo cuando lo sepa; por defecto se asume que no lo es.
   */
  isRecapture?: boolean;
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function opponentOf(color: Color): Color {
  return color === "w" ? "b" : "w";
}

function leastValuableAttacker(
  chess: Chess,
  square: Square,
  color: Color,
): Square | undefined {
  let best: Square | undefined;
  let bestValue = Infinity;
  for (const sq of chess.attackers(square, color)) {
    const piece = chess.get(sq);
    if (!piece) continue;
    const value = PIECE_VALUES[piece.type];
    if (value < bestValue) {
      bestValue = value;
      best = sq;
    }
  }
  return best;
}

/**
 * Static Exchange Evaluation simplificada: si `attackingColor` inicia una
 * serie de capturas en `square` y ambos bandos siempre recapturan con la
 * pieza de menor valor disponible, ¿cuánto material neto (en puntos de peón)
 * termina ganando `attackingColor`? Se usa para saber si una pieza queda
 * realmente colgada tras una jugada (no solo aparentemente capturable).
 */
export function staticExchangeEvaluation(
  fen: string,
  square: Square,
  attackingColor: Color,
): number {
  const chess = new Chess(fen, { skipValidation: true });
  const target = chess.get(square);
  if (!target) return 0;

  const gains: number[] = [PIECE_VALUES[target.type]];
  let sideToCapture = attackingColor;
  let attackerSquare = leastValuableAttacker(chess, square, sideToCapture);

  while (attackerSquare) {
    const attacker = chess.get(attackerSquare);
    if (!attacker) break;
    gains.push(PIECE_VALUES[attacker.type]);
    // Simula la captura reemplazando la pieza en el objetivo, sin validar
    // legalidad: solo nos interesa qué ataca a qué, no si la posición es legal.
    chess.remove(square);
    chess.remove(attackerSquare);
    chess.put({ type: attacker.type, color: attacker.color }, square);
    sideToCapture = opponentOf(sideToCapture);
    attackerSquare = leastValuableAttacker(chess, square, sideToCapture);
  }

  // Recorre la pila de capturas de atrás hacia adelante: en cada paso, el
  // bando que capturó solo "acepta" la ganancia si es mejor que dejarla pasar
  // (minimax de un intercambio de piezas, algoritmo clásico de SEE).
  let value = 0;
  for (let i = gains.length - 1; i > 0; i--) {
    value = Math.max(0, gains[i - 1]! - value);
  }
  return value;
}

function legalMoveCount(fen: string): number {
  return new Chess(fen).moves().length;
}

function destinationSquare(uci: string): Square {
  return uci.slice(2, 4) as Square;
}

interface RankedLine {
  line: EngineLine;
  winForMover: number;
}

function rankLinesForMover(
  engineLines: EngineLine[],
  color: Color,
): RankedLine[] {
  return engineLines
    .map((line) => ({
      line,
      winForMover: winPercentForMover(line.eval, color),
    }))
    .sort((a, b) => b.winForMover - a.winForMover);
}

/**
 * La línea del motor objetivamente mejor para quien mueve, entre las
 * candidatas dadas. La expone classify.ts para que otros módulos (p.ej.
 * report.ts, al calcular precisión y ACPL) no dupliquen este ranking.
 */
export function bestLineForMover(
  engineLines: EngineLine[],
  color: Color,
): EngineLine | undefined {
  return rankLinesForMover(engineLines, color)[0]?.line;
}

/**
 * ¿Había una victoria clara (mate forzado o táctica ganadora) que el jugador
 * dejó pasar con esta jugada? Se expone aparte de `classifyMove` porque, a
 * diferencia de las demás etiquetas, tiene sentido consultarlo como aviso
 * independiente sin importar qué etiqueta principal termine ganando.
 */
export function hasMissedWin(ctx: MoveContext): boolean {
  const ranked = rankLinesForMover(ctx.engineLines, ctx.color);
  const best = ranked[0];
  if (!best) return false;

  const winAfter = winPercentForMover(ctx.evalAfter, ctx.color);

  const bestWasForcedMateForMover =
    best.line.eval.type === "mate" &&
    (ctx.color === "w" ? best.line.eval.value > 0 : best.line.eval.value < 0);

  if (bestWasForcedMateForMover) {
    return winAfter < THRESHOLDS.missedWin.minWinPercentAvailable;
  }

  const hadClearWin =
    best.winForMover >= THRESHOLDS.missedWin.minWinPercentAvailable;
  if (!hadClearWin) return false;

  return best.winForMover - winAfter >= THRESHOLDS.missedWin.minGapFromBest;
}

function accuracyLossLabel(deltaWin: number): MoveLabel {
  const t = THRESHOLDS.accuracyLoss;
  if (deltaWin < t.excellent) return "excellent";
  if (deltaWin < t.good) return "good";
  if (deltaWin < t.inaccuracy) return "inaccuracy";
  if (deltaWin < t.mistake) return "mistake";
  return "blunder";
}

/**
 * Clasifica una jugada según, en este orden de prioridad: si sigue en libro,
 * si es brillante xd (sacrificio prácticamente único que mantiene la ventaja),
 * si es la única jugada que salva/mantiene la posición sin sacrificio, si
 * dejó pasar una victoria clara, y si no, según cuánto win% perdió respecto
 * a la mejor jugada disponible del motor.
 */
export function classifyMove(ctx: MoveContext): MoveLabel {
  if (ctx.inBook) return "book";

  const ranked = rankLinesForMover(ctx.engineLines, ctx.color);
  const best = ranked[0];
  const secondBest = ranked[1];

  const winBeforeBest = best ? best.winForMover : 50;
  const winAfter = winPercentForMover(ctx.evalAfter, ctx.color);
  const gapToSecondBest = best
    ? secondBest
      ? best.winForMover - secondBest.winForMover
      : Infinity
    : 0;
  const gapFromBest = best ? Math.max(0, best.winForMover - winAfter) : 0;
  const isNearBestLine = gapFromBest <= THRESHOLDS.brilliant.maxGapFromBestLine;
  const isForced = legalMoveCount(ctx.fenBefore) <= 1;

  const sacrificeValue = staticExchangeEvaluation(
    ctx.fenAfter,
    destinationSquare(ctx.uci),
    opponentOf(ctx.color),
  );

  const isBrilliant =
    !ctx.isRecapture &&
    !isForced &&
    isNearBestLine &&
    sacrificeValue >= THRESHOLDS.brilliant.minSacrificeValue &&
    winAfter >= THRESHOLDS.brilliant.minWinPercentAfter &&
    winBeforeBest < THRESHOLDS.brilliant.maxWinPercentBeforeToQualify &&
    gapToSecondBest >= THRESHOLDS.brilliant.minGapToSecondBest;
  if (isBrilliant) return "brilliant";

  const isGreat =
    !isForced &&
    gapFromBest <= THRESHOLDS.great.maxGapFromBestLine &&
    gapToSecondBest >= THRESHOLDS.great.minGapToSecondBest;
  if (isGreat) return "great";

  if (hasMissedWin(ctx)) return "missed_win";

  const playedEnginesBestMove = best?.line.pv[0] === ctx.uci;
  if (playedEnginesBestMove) return "best";

  return accuracyLossLabel(gapFromBest);
}
