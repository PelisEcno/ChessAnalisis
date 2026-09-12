import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  classifyMove,
  hasMissedWin,
  staticExchangeEvaluation,
  type EngineLine,
  type MoveContext,
} from "./classify.js";

// Inversa exacta de winPercent() en eval.ts: dado un win% objetivo, qué cp
// hay que usar para que evalToWinPercent lo reproduzca. Así los tests fijan
// deltas de win% exactos en vez de adivinar cp a ojo.
const WIN_PERCENT_K = 0.00368208;
function cpForWinPercent(targetWinPercent: number): number {
  return -Math.log(100 / targetWinPercent - 1) / WIN_PERCENT_K;
}

function cpLine(value: number, pv: string[]): EngineLine {
  return { eval: { type: "cp", value }, pv };
}

// Posición con solo los dos reyes: cualquier jugada de rey es legal, no hay
// piezas que capturar y por lo tanto el SEE en cualquier casilla es 0. Sirve
// para aislar la lógica de umbrales de classify.ts sin ruido táctico.
const BARE_KINGS_FEN = "6k1/8/8/8/8/8/8/6K1 w - - 0 1";

function bareKingsMove(uci: string) {
  const chess = new Chess(BARE_KINGS_FEN);
  const fenBefore = chess.fen();
  chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
  return { fenBefore, fenAfter: chess.fen() };
}

function makeThresholdContext(deltaWin: number): MoveContext {
  const { fenBefore, fenAfter } = bareKingsMove("g1h1");
  const bestWin = 60;
  return {
    fenBefore,
    fenAfter,
    color: "w",
    uci: "g1h1",
    inBook: false,
    engineLines: [
      cpLine(cpForWinPercent(bestWin), ["g1f2"]),
      cpLine(cpForWinPercent(bestWin - 3), ["g1f1"]),
      cpLine(cpForWinPercent(bestWin - 6), ["g1g2"]),
    ],
    evalAfter: { type: "cp", value: cpForWinPercent(bestWin - deltaWin) },
  };
}

describe("staticExchangeEvaluation", () => {
  it("es 0 si no hay ningún atacante en la casilla", () => {
    const fen = "6k1/8/8/8/8/8/8/6K1 w - - 0 1";
    expect(staticExchangeEvaluation(fen, "h1", "b")).toBe(0);
  });

  it("detecta una pieza colgada sin ningún defensor", () => {
    // Dama blanca en e5, peón negro en d6 la ataca, nadie la defiende.
    const fen = "6k1/8/3p4/4Q3/8/8/8/6K1 b - - 0 1";
    expect(staticExchangeEvaluation(fen, "e5", "b")).toBe(9);
  });

  it("resuelve una cadena de capturas con el minimax clásico de SEE", () => {
    // Dama blanca en e5 defendida por una torre en e1; peón negro en d6 ataca.
    // Negras capturan la dama (+9), blancas recapturan el peón con la torre
    // (-1 para negras): ganancia neta para negras = 9 - 1 = 8.
    const fen = "6k1/8/3p4/4Q3/8/8/8/4R1K1 b - - 0 1";
    expect(staticExchangeEvaluation(fen, "e5", "b")).toBe(8);
  });
});

describe("classifyMove — libro y jugada del motor", () => {
  it("devuelve 'book' si la posición sigue en libro, sin mirar nada más", () => {
    const { fenBefore, fenAfter } = bareKingsMove("g1h1");
    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "g1h1",
      inBook: true,
      engineLines: [],
      evalAfter: { type: "cp", value: 0 },
    };
    expect(classifyMove(ctx)).toBe("book");
  });

  it("devuelve 'best' cuando la jugada jugada es literalmente la #1 del motor", () => {
    const { fenBefore, fenAfter } = bareKingsMove("g1h1");
    const bestCp = cpForWinPercent(60);
    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "g1h1",
      inBook: false,
      engineLines: [
        cpLine(bestCp, ["g1h1"]),
        cpLine(cpForWinPercent(57), ["g1f1"]),
        cpLine(cpForWinPercent(54), ["g1g2"]),
      ],
      evalAfter: { type: "cp", value: bestCp },
    };
    expect(classifyMove(ctx)).toBe("best");
  });
});

describe("classifyMove — escalera de precisión por ΔWin%", () => {
  it("ΔWin muy pequeña -> excellent", () => {
    expect(classifyMove(makeThresholdContext(1))).toBe("excellent");
  });

  it("ΔWin pequeña -> good", () => {
    expect(classifyMove(makeThresholdContext(3))).toBe("good");
  });

  it("ΔWin moderada -> inaccuracy", () => {
    expect(classifyMove(makeThresholdContext(7))).toBe("inaccuracy");
  });

  it("ΔWin alta -> mistake", () => {
    expect(classifyMove(makeThresholdContext(15))).toBe("mistake");
  });

  it("ΔWin muy alta -> blunder", () => {
    expect(classifyMove(makeThresholdContext(30))).toBe("blunder");
  });
});

describe("classifyMove — brilliant", () => {
  it("marca 'brilliant' un sacrificio único que mantiene la ventaja", () => {
    const chess = new Chess("6k1/8/3p4/8/3Q4/8/8/6K1 w - - 0 1");
    const fenBefore = chess.fen();
    chess.move({ from: "d4", to: "e5" });
    const fenAfter = chess.fen();

    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "d4e5",
      inBook: false,
      engineLines: [
        cpLine(150, ["d4e5"]),
        cpLine(-50, ["d4d2"]),
        cpLine(-80, ["g1f1"]),
      ],
      evalAfter: { type: "cp", value: 140 },
    };

    expect(classifyMove(ctx)).toBe("brilliant");
  });

  it("no marca 'brilliant' si la jugada es una simple recaptura", () => {
    const chess = new Chess("6k1/8/3p4/8/3Q4/8/8/6K1 w - - 0 1");
    const fenBefore = chess.fen();
    chess.move({ from: "d4", to: "e5" });
    const fenAfter = chess.fen();

    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "d4e5",
      inBook: false,
      isRecapture: true,
      engineLines: [
        cpLine(150, ["d4e5"]),
        cpLine(-50, ["d4d2"]),
        cpLine(-80, ["g1f1"]),
      ],
      evalAfter: { type: "cp", value: 140 },
    };

    expect(classifyMove(ctx)).not.toBe("brilliant");
  });
});

describe("classifyMove — great", () => {
  it("marca 'great' la única jugada que mantiene la posición, sin sacrificio", () => {
    const { fenBefore, fenAfter } = bareKingsMove("g1h1");
    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "g1h1",
      inBook: false,
      engineLines: [
        cpLine(0, ["g1f1"]),
        cpLine(-300, ["g1g2"]),
        cpLine(-350, ["g1f2"]),
      ],
      evalAfter: { type: "cp", value: -5 },
    };
    expect(classifyMove(ctx)).toBe("great");
  });
});

describe("hasMissedWin / classifyMove — missed_win", () => {
  it("detecta un mate forzado que se dejó pasar", () => {
    const { fenBefore, fenAfter } = bareKingsMove("g1h1");
    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "g1h1",
      inBook: false,
      engineLines: [
        { eval: { type: "mate", value: 2 }, pv: ["g1f2"] },
        cpLine(50, ["g1f1"]),
        cpLine(0, ["g1g2"]),
      ],
      evalAfter: { type: "cp", value: 20 },
    };

    expect(hasMissedWin(ctx)).toBe(true);
    expect(classifyMove(ctx)).toBe("missed_win");
  });

  it("detecta una táctica claramente ganadora (no mate) que se dejó pasar", () => {
    const { fenBefore, fenAfter } = bareKingsMove("g1h1");
    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "g1h1",
      inBook: false,
      engineLines: [
        cpLine(900, ["g1f2"]),
        cpLine(50, ["g1f1"]),
        cpLine(0, ["g1g2"]),
      ],
      evalAfter: { type: "cp", value: 100 },
    };

    expect(hasMissedWin(ctx)).toBe(true);
  });

  it("no marca missed_win si la jugada mantiene la victoria clara", () => {
    const { fenBefore, fenAfter } = bareKingsMove("g1h1");
    const ctx: MoveContext = {
      fenBefore,
      fenAfter,
      color: "w",
      uci: "g1h1",
      inBook: false,
      engineLines: [
        { eval: { type: "mate", value: 2 }, pv: ["g1h1"] },
        cpLine(50, ["g1f1"]),
        cpLine(0, ["g1g2"]),
      ],
      evalAfter: { type: "mate", value: 1 },
    };

    expect(hasMissedWin(ctx)).toBe(false);
  });
});
