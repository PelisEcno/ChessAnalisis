import { describe, expect, it } from "vitest";
import { parseUciInfoLine } from "./uci.js";

describe("parseUciInfoLine", () => {
  it("parsea una línea con score cp", () => {
    const line =
      "info depth 18 seldepth 24 multipv 1 score cp 34 nodes 123456 nps 987654 time 234 pv e2e4 e7e5 g1f3";
    expect(parseUciInfoLine(line)).toEqual({
      depth: 18,
      multipv: 1,
      scoreCp: 34,
      mateIn: undefined,
      pv: ["e2e4", "e7e5", "g1f3"],
    });
  });

  it("parsea una línea con score mate", () => {
    const line =
      "info depth 10 seldepth 4 multipv 2 score mate 3 nodes 1862 pv a2a1 h1h2 a1c1";
    const result = parseUciInfoLine(line);
    expect(result?.mateIn).toBe(3);
    expect(result?.scoreCp).toBeUndefined();
  });

  it("ignora líneas sin pv", () => {
    expect(parseUciInfoLine("info string NNUE evaluation enabled")).toBeNull();
  });

  it("ignora líneas que no empiezan con 'info '", () => {
    expect(parseUciInfoLine("bestmove e2e4 ponder e7e5")).toBeNull();
  });
});
