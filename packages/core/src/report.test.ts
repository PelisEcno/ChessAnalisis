import { describe, expect, it } from "vitest";
import type { EngineLine, MoveContext } from "./classify.js";
import { parsePgn } from "./pgn.js";
import { buildReport } from "./report.js";

const PGN = `[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O *`;

function cpLine(cp: number, pv: string[]): EngineLine {
  return { eval: { type: "cp", value: cp }, pv };
}

// Ply 12 = 6...b5 (negras): la marcamos como el único blunder de la partida.
const BLUNDER_PLY = 12;

const game = parsePgn(PGN);

const analyzed: MoveContext[] = game.positions.map((position) => {
  const isBlunder = position.ply === BLUNDER_PLY;

  if (isBlunder) {
    // Negras tenían una jugada tranquila que mantenía la posición (mejor
    // línea del motor, cp desde la perspectiva de blancas = -60, favorable
    // a negras) y en cambio juegan algo que deja a blancas ganando de lejos.
    return {
      fenBefore: position.fenBefore,
      fenAfter: position.fenAfter,
      color: position.color,
      uci: position.uci,
      inBook: false,
      engineLines: [
        cpLine(-60, ["h2h4"]),
        cpLine(-40, ["a2a3"]),
        cpLine(-20, ["d2d3"]),
      ],
      evalAfter: { type: "cp", value: 400 },
    };
  }

  // El resto de la partida son todas "la mejor jugada del motor": el cp de
  // la mejor línea se orienta según de qué bando es el turno (positivo
  // favorece a blancas, así que para negras usamos el signo opuesto).
  const sign = position.color === "w" ? 1 : -1;
  const bestCp = sign * 20;
  return {
    fenBefore: position.fenBefore,
    fenAfter: position.fenAfter,
    color: position.color,
    uci: position.uci,
    inBook: false,
    engineLines: [
      cpLine(bestCp, [position.uci]),
      cpLine(sign * 17, ["h2h4"]),
      cpLine(sign * 14, ["a2a3"]),
    ],
    evalAfter: { type: "cp", value: bestCp },
  };
});

const report = buildReport(game, analyzed);

describe("buildReport", () => {
  it("detecta la apertura real de la partida vía el índice ECO", () => {
    // El dataset no tiene una entrada nombrada para cada ply de esta línea
    // principal: el libro se corta en la última posición indexada (ply 6),
    // aunque 7...O-O etc. sigan siendo teoría reconocida en la práctica.
    expect(report.opening).toBeDefined();
    expect(report.opening!.eco).toBe("C70");
    expect(report.opening!.name).toContain("Ruy Lopez");
    expect(report.opening!.lastBookPly).toBe(6);
  });

  it("etiqueta el blunder como tal y el resto de jugadas como 'best'", () => {
    const blunderMove = report.moves.find((m) => m.ply === BLUNDER_PLY);
    expect(blunderMove?.label).toBe("blunder");
    expect(blunderMove?.color).toBe("b");

    const rest = report.moves.filter((m) => m.ply !== BLUNDER_PLY);
    expect(rest.every((m) => m.label === "best")).toBe(true);
  });

  it("el bando que blunderea tiene esa jugada como su peor jugada", () => {
    expect(report.players.b.worstMove?.ply).toBe(BLUNDER_PLY);
  });

  it("la precisión de cada bando refleja el blunder", () => {
    expect(report.players.w.accuracy).toBeCloseTo(100, 0);
    expect(report.players.b.accuracy).toBeLessThan(report.players.w.accuracy);
  });

  it("el blunder es el momento más crítico de la partida", () => {
    expect(report.criticalMoments[0]?.ply).toBe(BLUNDER_PLY);
  });

  it("clasifica la fase por material, no por número de jugada", () => {
    // Ninguna captura ocurre en esta línea: sigue siendo "opening" en material
    // durante las 16 jugadas, aunque ya estemos en la jugada 8.
    expect(report.moves.every((m) => m.phase === "opening")).toBe(true);
  });

  it("cuenta las etiquetas por jugador por separado", () => {
    expect(report.players.w.labelCounts.best).toBe(8);
    expect(report.players.b.labelCounts.best).toBe(7);
    expect(report.players.b.labelCounts.blunder).toBe(1);
  });
});
