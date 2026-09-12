import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { detectOpening } from "./openings.js";

function fensForSan(sanMoves: string[]): string[] {
  const chess = new Chess();
  return sanMoves.map((san) => {
    chess.move(san);
    return chess.fen();
  });
}

describe("detectOpening", () => {
  it("detecta una apertura conocida y el ply exacto donde se sale de teoría", () => {
    // 1. e4 e5 2. Nf3 Nc6 3. Bb5 es la Ruy López / Spanish Opening (C60),
    // y 3...a6 es la variante Morphy (C68/C70 según lo que siga). Después
    // jugamos algo raro para forzar la salida de libro.
    const fens = fensForSan([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bb5",
      "a6",
      "h3", // ya no es una línea principal indexada, corta el libro acá
    ]);

    const opening = detectOpening(fens);

    expect(opening).toBeDefined();
    expect(opening!.eco.startsWith("C")).toBe(true);
    expect(opening!.lastBookPly).toBeLessThan(fens.length);
    expect(opening!.lastBookPly).toBeGreaterThanOrEqual(5);
  });

  it("devuelve undefined si ni siquiera 1. e4 hipotético no matchea (fens vacío)", () => {
    expect(detectOpening([])).toBeUndefined();
  });

  it("detecta la apertura ya desde la primera jugada", () => {
    const fens = fensForSan(["e4"]);
    const opening = detectOpening(fens);
    expect(opening).toBeDefined();
    expect(opening!.lastBookPly).toBe(1);
  });

  it("la profundidad de libro crece a medida que la partida sigue una línea conocida", () => {
    const afterThree = detectOpening(fensForSan(["e4", "e5", "Nf3"]));
    const afterFive = detectOpening(
      fensForSan(["e4", "e5", "Nf3", "Nc6", "Bb5"]),
    );
    expect(afterThree).toBeDefined();
    expect(afterFive).toBeDefined();
    expect(afterFive!.lastBookPly).toBeGreaterThan(afterThree!.lastBookPly);
  });
});
