import type { Eval, EngineResult } from "@peon-libre/core";

export function sideToMoveFromFen(fen: string): "w" | "b" {
  return (fen.split(" ")[1] as "w" | "b" | undefined) ?? "w";
}

/** Convierte una línea del motor (perspectiva UCI) a Eval en perspectiva de blancas. */
export function lineToWhiteEval(
  line: EngineResult["lines"][number],
  sideToMove: "w" | "b",
): Eval {
  if (line.mateIn !== undefined) {
    return {
      type: "mate",
      value: sideToMove === "w" ? line.mateIn : -line.mateIn,
    };
  }
  const cp = line.scoreCp ?? 0;
  return { type: "cp", value: sideToMove === "w" ? cp : -cp };
}

export function bestLineOf(
  result: EngineResult,
): EngineResult["lines"][number] | undefined {
  return (
    result.lines.find((l) => l.multipv === 1) ??
    result.lines.slice().sort((a, b) => a.multipv - b.multipv)[0]
  );
}
