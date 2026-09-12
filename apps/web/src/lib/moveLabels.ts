import type { AnnotatedMove, MoveLabel } from "@peon-libre/core";

export const MOVE_LABEL_META: Record<
  MoveLabel,
  { text: string; glyph: string; color: string }
> = {
  book: { text: "Libro", glyph: "", color: "var(--label-book)" },
  brilliant: {
    text: "Brillante",
    glyph: "!!",
    color: "var(--label-brilliant)",
  },
  great: { text: "Gran jugada", glyph: "!", color: "var(--label-great)" },
  best: { text: "Mejor jugada", glyph: "", color: "var(--label-best)" },
  excellent: { text: "Excelente", glyph: "", color: "var(--label-excellent)" },
  good: { text: "Buena", glyph: "", color: "var(--label-good)" },
  inaccuracy: {
    text: "Imprecisión",
    glyph: "?!",
    color: "var(--label-inaccuracy)",
  },
  mistake: { text: "Error", glyph: "?", color: "var(--label-mistake)" },
  blunder: { text: "Blunder", glyph: "??", color: "var(--label-blunder)" },
  missed_win: {
    text: "Victoria perdida",
    glyph: "△",
    color: "var(--label-missed-win)",
  },
};

/**
 * Explicación mínima en lenguaje natural a partir de la etiqueta. Es un
 * placeholder de la fase 4: la fase 7 la reemplaza por narration.ts, que
 * arma la frase mencionando piezas y casillas concretas en vez de solo la
 * etiqueta y el ΔWin.
 */
export function describeMove(move: AnnotatedMove): string {
  const delta = Math.round(move.deltaWin);
  switch (move.label) {
    case "book":
      return "Todavía es teoría de apertura conocida.";
    case "brilliant":
      return "¡Jugada brillante! Un sacrificio prácticamente único que mantiene la ventaja.";
    case "great":
      return "La única jugada que mantenía la posición.";
    case "best":
      return "La mejor jugada según el motor.";
    case "excellent":
      return "Una jugada casi perfecta.";
    case "good":
      return "Buena jugada, sin pérdida relevante.";
    case "inaccuracy":
      return `Imprecisión: perdiste ${delta}% de probabilidad de ganar.`;
    case "mistake":
      return `Error: perdiste ${delta}% de probabilidad de ganar.`;
    case "blunder":
      return `Blunder: perdiste ${delta}% de probabilidad de ganar.`;
    case "missed_win":
      return "Había una victoria clara disponible y no se jugó.";
  }
}
