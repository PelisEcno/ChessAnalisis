import type { Color, Eval } from "./types.js";

/** Centipawns a los que saturamos un mate al convertir a cp para graficar. */
const MATE_CP_CAP = 1000;

/**
 * Convierte una evaluación en centipawns a probabilidad de ganar (0-100),
 * siempre desde la perspectiva de las blancas. Perder 200cp en una posición
 * igualada es mucho peor que perderlos con +900 de ventaja, por eso todo el
 * resto del paquete juzga jugadas en esta escala y no en cp crudos.
 *
 * Constante calibrada por Lichess a partir de partidas reales
 * (https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/WinPercent.scala).
 */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Win% de una evaluación completa (cp o mate), desde la perspectiva de las
 * blancas. Un mate a favor de blancas es 100%, a favor de negras es 0%.
 */
export function evalToWinPercent(evaluation: Eval): number {
  if (evaluation.type === "mate") {
    if (evaluation.value === 0) return 100;
    return evaluation.value > 0 ? 100 : 0;
  }
  return winPercent(evaluation.value);
}

/**
 * Win% de una evaluación desde la perspectiva de quien mueve. Las
 * evaluaciones siempre se guardan en perspectiva de blancas; para negras hay
 * que invertirlo antes de comparar la pérdida de la propia jugada.
 */
export function winPercentForMover(evaluation: Eval, mover: Color): number {
  const whiteWin = evalToWinPercent(evaluation);
  return mover === "w" ? whiteWin : 100 - whiteWin;
}

/**
 * Convierte una evaluación a centipawns saturados en ±1000, útil para
 * graficar (un mate en 1 y un mate en 20 no deben deformar el eje del
 * gráfico de evaluación de la misma manera que +900 de material sí importa).
 */
export function evalToCp(evaluation: Eval): number {
  if (evaluation.type === "mate") {
    if (evaluation.value === 0) return MATE_CP_CAP;
    return evaluation.value > 0 ? MATE_CP_CAP : -MATE_CP_CAP;
  }
  return Math.max(-MATE_CP_CAP, Math.min(MATE_CP_CAP, evaluation.value));
}

/**
 * Cp saturado (±1000) de una evaluación desde la perspectiva de quien mueve,
 * análogo a `winPercentForMover` pero en centipawns. Se usa para ACPL.
 */
export function cpForMover(evaluation: Eval, mover: Color): number {
  const cp = evalToCp(evaluation);
  return mover === "w" ? cp : -cp;
}

/**
 * Precisión de una jugada individual (0-100) a partir del win% de quien
 * mueve antes y después de jugarla. `winBefore`/`winAfter` deben estar en la
 * misma perspectiva (la del jugador que movió), típicamente obtenidos con
 * `winPercentForMover`.
 */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

const MIN_ACCURACY_FOR_HARMONIC_MEAN = 1;

/**
 * Desviación estándar de una ventana centrada en cada índice del array; se
 * usa como aproximación de "qué tan volátil" fue ese tramo de la partida.
 */
function rollingVolatility(values: number[], windowRadius: number): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - windowRadius);
    const end = Math.min(values.length, i + windowRadius + 1);
    const window = values.slice(start, end);
    const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
    const variance =
      window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
    return Math.sqrt(variance);
  });
}

/**
 * Precisión global de la partida a partir de la precisión de cada jugada.
 * No es un promedio simple: usa una media armónica (que castiga fuerte los
 * valores bajos, es decir los blunders) ponderada por la volatilidad local
 * de las precisiones, para que los momentos críticos de la partida pesen
 * más que las jugadas de trámite en una posición ya decidida.
 *
 * NOTA: esta función solo recibe las precisiones por jugada (no la serie de
 * evaluaciones cruda), así que la "volatilidad" es una aproximación basada
 * en la propia dispersión local de esas precisiones. Es un valor provisional
 * pensado para calibrarse igual que THRESHOLDS una vez haya partidas reales
 * con las que comparar contra el Game Review de Chess.com.
 */
export function gameAccuracy(moveAccuracies: number[]): number {
  if (moveAccuracies.length === 0) return 100;

  const volatility = rollingVolatility(moveAccuracies, 2);
  const weights = volatility.map((v) => v + 1);
  const values = moveAccuracies.map((a) =>
    Math.max(a, MIN_ACCURACY_FOR_HARMONIC_MEAN),
  );

  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const weightedInverseSum = values.reduce(
    (sum, v, i) => sum + weights[i]! / v,
    0,
  );

  return weightSum / weightedInverseSum;
}
