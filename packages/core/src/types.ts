export type Color = "w" | "b";

/**
 * Evaluación de una posición. Por convención en todo el paquete, siempre se
 * guarda desde la perspectiva de las blancas: cp positivo o mate con value
 * positivo favorecen a blancas; negativo favorece a negras.
 */
export type Eval =
  { type: "cp"; value: number } | { type: "mate"; value: number };
