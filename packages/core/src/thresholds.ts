/**
 * Todos los umbrales numéricos que usa classify.ts, juntos en un solo lugar
 * para poder calibrarlos sin tocar la lógica de clasificación.
 *
 * PROVISIONALES: son valores de partida razonables, no calibrados todavía.
 * La calibración real se hace comparando ~30-50 partidas propias analizadas
 * acá contra el Game Review de Chess.com y ajustando estos números hasta que
 * las etiquetas coincidan (ver tarea de calibración en el README del repo).
 */
export const THRESHOLDS = {
  /**
   * Pérdida de win% (respecto a la mejor jugada del motor) que separa cada
   * etiqueta de la siguiente. Son límites superiores exclusivos: si
   * `deltaWin < excellent` es 'excellent', si `deltaWin < good` es 'good', etc.
   * Todo lo que sea >= mistake y no entre en las demás cae en 'blunder'.
   */
  accuracyLoss: {
    excellent: 2,
    good: 5,
    inaccuracy: 10,
    mistake: 20,
  },

  brilliant: {
    /** Mínimo material (en puntos de peón) que debe quedar realmente colgado tras la jugada. */
    minSacrificeValue: 3,
    /** Win% mínimo (perspectiva de quien mueve) que debe quedar tras la jugada. */
    minWinPercentAfter: 50,
    /** Si el jugador ya estaba ganando por encima de esto, un sacrificio no cuenta como brillante. */
    maxWinPercentBeforeToQualify: 95,
    /** Diferencia mínima de win% entre la mejor línea y la segunda para considerarla "prácticamente única". */
    minGapToSecondBest: 8,
    /** Cuánto puede alejarse la jugada jugada de la mejor línea del motor y seguir contando como "la" jugada a encontrar. */
    maxGapFromBestLine: 2,
  },

  great: {
    minGapToSecondBest: 6,
    maxGapFromBestLine: 2,
  },

  missedWin: {
    /** Win% mínimo de la mejor línea disponible para considerar que había una victoria clara. */
    minWinPercentAvailable: 95,
    /** Cuánto por debajo de esa mejor línea debe caer la jugada jugada para contar como "se la perdió". */
    minGapFromBest: 10,
  },
} as const;
