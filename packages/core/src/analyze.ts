import type { EngineLine, MoveContext } from "./classify.js";
import type { EngineLineResult, EngineResult } from "./engine/types.js";
import { detectOpening } from "./openings.js";
import type { ParsedGame } from "./pgn.js";
import { buildReport, type GameReport } from "./report.js";
import type { Color, Eval } from "./types.js";

function opponentOf(color: Color): Color {
  return color === "w" ? "b" : "w";
}

/**
 * Convierte una línea del motor (perspectiva UCI: relativa a quien mueve en
 * la posición analizada) a la convención de `Eval` del paquete (siempre
 * perspectiva de blancas).
 */
function engineLineToEval(line: EngineLineResult, sideToMove: Color): Eval {
  if (line.mateIn !== undefined) {
    return {
      type: "mate",
      value: sideToMove === "w" ? line.mateIn : -line.mateIn,
    };
  }
  const cp = line.scoreCp ?? 0;
  return { type: "cp", value: sideToMove === "w" ? cp : -cp };
}

function bestLine(result: EngineResult): EngineLineResult | undefined {
  return (
    result.lines.find((line) => line.multipv === 1) ??
    result.lines.slice().sort((a, b) => a.multipv - b.multipv)[0]
  );
}

/**
 * Arma el GameReport completo de una partida a partir de los resultados
 * crudos del motor: uno por CADA posición de la partida, en orden, incluida
 * la inicial. Es decir, `engineResults.length` debe ser
 * `game.positions.length + 1` (la posición antes de la jugada 1, más la
 * posición resultante de cada jugada).
 *
 * Acá es donde se hace la conversión de perspectiva UCI (relativa a quien
 * mueve en el FEN analizado) a la convención de `Eval` de todo el paquete
 * (siempre perspectiva de blancas), y se arman los MoveContext que
 * classify.ts necesita antes de llamar a buildReport.
 */
export function buildGameReport(
  game: ParsedGame,
  engineResults: EngineResult[],
): GameReport {
  const expected = game.positions.length + 1;
  if (engineResults.length !== expected) {
    throw new Error(
      `Se esperaban ${expected} resultados del motor (uno por posición, incluida la inicial), llegaron ${engineResults.length}.`,
    );
  }

  const fensAfter = game.positions.map((p) => p.fenAfter);
  const lastBookPly = detectOpening(fensAfter)?.lastBookPly ?? 0;

  const contexts: MoveContext[] = game.positions.map((position, i) => {
    const before = engineResults[i]!;
    const after = engineResults[i + 1]!;

    const engineLines: EngineLine[] = before.lines
      .slice()
      .sort((a, b) => a.multipv - b.multipv)
      .map((line) => ({
        eval: engineLineToEval(line, position.color),
        pv: line.pv,
      }));

    const afterBest = bestLine(after);
    const evalAfter: Eval = afterBest
      ? engineLineToEval(afterBest, opponentOf(position.color))
      : { type: "cp", value: 0 };

    return {
      fenBefore: position.fenBefore,
      fenAfter: position.fenAfter,
      color: position.color,
      uci: position.uci,
      engineLines,
      evalAfter,
      inBook: position.ply <= lastBookPly,
    };
  });

  return buildReport(game, contexts);
}
