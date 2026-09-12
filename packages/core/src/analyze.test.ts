import { describe, expect, it } from "vitest";
import { buildGameReport } from "./analyze.js";
import type { EngineResult } from "./engine/types.js";
import { parsePgn } from "./pgn.js";

// Misma línea que report.test.ts: Ruy López Cerrada. Confirmado ahí que el
// dataset ECO se queda sin match a partir del ply 6 (C70, Morphy Defense),
// así que todo lo que sigue después ya NO está en libro.
const PGN = `[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O *`;

const game = parsePgn(PGN);

function line(cp: number, pv: string[]): EngineResult["lines"][number] {
  return { multipv: 1, scoreCp: cp, pv, depth: 18 };
}

// Índice 11 (0-indexado) = ply 12 = 6...b5 (negras), bien fuera de libro.
const BLUNDER_INDEX = 11;

function buildEngineResults(): EngineResult[] {
  // engineResults[i] = análisis ANTES de jugar positions[i] (perspectiva UCI:
  // relativa a quien mueve ahí). engineResults[N] = posición final.
  const perMove: EngineResult[] = game.positions.map((position, i) => {
    if (i === BLUNDER_INDEX) {
      // Negras a mover: había una jugada tranquila mejor que la que juegan.
      return { lines: [line(30, ["h7h6"])] };
    }
    return { lines: [line(20, [position.uci])] };
  });

  // La posición justo DESPUÉS del blunder debe reflejar que ahora blancas
  // están mucho mejor (score UCI en la perspectiva de blancas, que mueven
  // ahí). Mantenemos el pv apuntando a la jugada 12 real para que ESA
  // jugada (7.Bb3, sin relación con el blunder) se siga clasificando 'best'.
  perMove[BLUNDER_INDEX + 1] = {
    lines: [line(300, [game.positions[BLUNDER_INDEX + 1]!.uci])],
  };

  const finalPosition: EngineResult = { lines: [line(15, ["a2a3"])] };
  return [...perMove, finalPosition];
}

describe("buildGameReport", () => {
  it("marca de libro las primeras 6 jugadas y 'best' el resto (salvo el blunder)", () => {
    const engineResults = buildEngineResults();
    const report = buildGameReport(game, engineResults);

    const bookMoves = report.moves.slice(0, 6);
    expect(bookMoves.every((m) => m.label === "book")).toBe(true);

    const outOfBook = report.moves
      .slice(6)
      .filter((_, i) => i + 6 !== BLUNDER_INDEX);
    expect(outOfBook.every((m) => m.label === "best")).toBe(true);
  });

  it("detecta el blunder y lo atribuye al bando correcto", () => {
    const engineResults = buildEngineResults();
    const report = buildGameReport(game, engineResults);

    const blunderMove = report.moves[BLUNDER_INDEX]!;
    expect(blunderMove.color).toBe("b");
    expect(blunderMove.san).toBe("b5");
    expect(blunderMove.label).not.toBe("book");
    expect(["mistake", "blunder"]).toContain(blunderMove.label);
    expect(report.players.b.worstMove?.ply).toBe(blunderMove.ply);
  });

  it("tira un error claro si falta algún resultado del motor", () => {
    const engineResults = buildEngineResults().slice(0, -1);
    expect(() => buildGameReport(game, engineResults)).toThrow(/Se esperaban/);
  });
});
