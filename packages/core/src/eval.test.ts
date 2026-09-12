import { describe, expect, it } from "vitest";
import {
  evalToCp,
  evalToWinPercent,
  gameAccuracy,
  moveAccuracy,
  winPercent,
  winPercentForMover,
} from "./eval.js";

describe("winPercent", () => {
  it("es 50 en una posición igualada", () => {
    expect(winPercent(0)).toBeCloseTo(50, 10);
  });

  it("es monótona creciente en cp", () => {
    expect(winPercent(-500)).toBeLessThan(winPercent(-100));
    expect(winPercent(-100)).toBeLessThan(winPercent(0));
    expect(winPercent(0)).toBeLessThan(winPercent(100));
    expect(winPercent(100)).toBeLessThan(winPercent(500));
  });

  it("es simétrica: winPercent(-x) = 100 - winPercent(x)", () => {
    for (const x of [1, 37, 100, 250, 900]) {
      expect(winPercent(-x)).toBeCloseTo(100 - winPercent(x), 10);
    }
  });

  it("se acerca a 100/0 en ventajas grandes sin llegar a superarlas", () => {
    expect(winPercent(5000)).toBeLessThan(100);
    expect(winPercent(5000)).toBeGreaterThan(99);
    expect(winPercent(-5000)).toBeGreaterThan(0);
    expect(winPercent(-5000)).toBeLessThan(1);
  });
});

describe("evalToWinPercent", () => {
  it("mate a favor de blancas es 100%", () => {
    expect(evalToWinPercent({ type: "mate", value: 3 })).toBe(100);
  });

  it("mate a favor de negras es 0%", () => {
    expect(evalToWinPercent({ type: "mate", value: -2 })).toBe(0);
  });

  it("delega en winPercent para evaluaciones en cp", () => {
    expect(evalToWinPercent({ type: "cp", value: 0 })).toBeCloseTo(50, 10);
  });
});

describe("winPercentForMover", () => {
  it("no cambia nada para blancas", () => {
    const evaluation: import("./types.js").Eval = { type: "cp", value: 200 };
    expect(winPercentForMover(evaluation, "w")).toBeCloseTo(
      evalToWinPercent(evaluation),
      10,
    );
  });

  it("invierte el porcentaje para negras", () => {
    const evaluation: import("./types.js").Eval = { type: "cp", value: 200 };
    expect(winPercentForMover(evaluation, "b")).toBeCloseTo(
      100 - evalToWinPercent(evaluation),
      10,
    );
  });
});

describe("evalToCp", () => {
  it("pasa cp normales sin cambios", () => {
    expect(evalToCp({ type: "cp", value: 150 })).toBe(150);
  });

  it("satura cp extremos en ±1000", () => {
    expect(evalToCp({ type: "cp", value: 5000 })).toBe(1000);
    expect(evalToCp({ type: "cp", value: -5000 })).toBe(-1000);
  });

  it("satura mates en ±1000 según el bando que mata", () => {
    expect(evalToCp({ type: "mate", value: 4 })).toBe(1000);
    expect(evalToCp({ type: "mate", value: -1 })).toBe(-1000);
  });
});

describe("moveAccuracy", () => {
  it("es ~100 cuando no hay pérdida de win%", () => {
    expect(moveAccuracy(55, 55)).toBeCloseTo(100, 0);
  });

  it("baja a medida que crece la pérdida de win%", () => {
    const small = moveAccuracy(50, 45);
    const big = moveAccuracy(50, 10);
    expect(big).toBeLessThan(small);
  });

  it("nunca es negativa ni mayor a 100", () => {
    expect(moveAccuracy(90, 0)).toBeGreaterThanOrEqual(0);
    expect(moveAccuracy(10, 100)).toBeLessThanOrEqual(100);
  });
});

describe("gameAccuracy", () => {
  it("es 100 en una partida perfecta", () => {
    expect(gameAccuracy([100, 100, 100, 100])).toBeCloseTo(100, 5);
  });

  it("un blunder aislado pesa más que en un promedio simple", () => {
    const accuracies = [95, 96, 94, 5, 97, 96, 95];
    const simpleMean =
      accuracies.reduce((s, v) => s + v, 0) / accuracies.length;
    expect(gameAccuracy(accuracies)).toBeLessThan(simpleMean);
  });

  it("una partida más floja da menor accuracy que una más sólida", () => {
    const solid = [95, 96, 94, 97, 96, 95];
    const shaky = [80, 70, 85, 60, 75, 90];
    expect(gameAccuracy(shaky)).toBeLessThan(gameAccuracy(solid));
  });

  it("devuelve 100 para una partida vacía", () => {
    expect(gameAccuracy([])).toBe(100);
  });
});
