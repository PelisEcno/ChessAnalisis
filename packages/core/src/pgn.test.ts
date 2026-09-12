import { describe, expect, it } from "vitest";
import { parsePgn } from "./pgn.js";

const CHESSCOM_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.15"]
[Round "-"]
[White "PlayerOne"]
[Black "PlayerTwo"]
[Result "1-0"]
[ECO "C50"]
[WhiteElo "1500"]
[BlackElo "1490"]
[TimeControl "600"]
[Termination "PlayerOne won by checkmate"]

1. e4 {[%clk 0:09:58]} 1... e5 {[%clk 0:09:57]} 2. Nf3 {[%clk 0:09:55]} 2... Nc6 {[%clk 0:09:54]}
3. Bc4 {[%clk 0:09:50]} 3... Bc5 {[%clk 0:09:52]} 1-0`;

const LICHESS_PGN = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abcdefgh"]
[Date "2024.01.15"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[WhiteElo "1800"]
[BlackElo "1820"]
[TimeControl "300+3"]
[ECO "B01"]
[Opening "Scandinavian Defense"]
[Termination "Normal"]

1. e4 { [%eval 0.3] [%clk 0:05:00] } 1... d5 { [%eval 0.2] [%clk 0:05:03] }
2. exd5 { [%eval 0.25] [%clk 0:04:58] } 2... Qxd5 { [%eval 0.1] [%clk 0:05:02] } 0-1`;

describe("parsePgn", () => {
  it("parsea headers comunes de una partida de Chess.com", () => {
    const game = parsePgn(CHESSCOM_PGN);

    expect(game.headers.white).toBe("PlayerOne");
    expect(game.headers.black).toBe("PlayerTwo");
    expect(game.headers.result).toBe("1-0");
    expect(game.headers.eco).toBe("C50");
    expect(game.headers.whiteElo).toBe(1500);
    expect(game.headers.blackElo).toBe(1490);
    expect(game.headers.timeControl).toBe("600");
  });

  it("extrae las jugadas en SAN, UCI y el FEN antes/después de cada una", () => {
    const game = parsePgn(CHESSCOM_PGN);

    expect(game.positions).toHaveLength(6);

    const first = game.positions[0]!;
    expect(first.ply).toBe(1);
    expect(first.moveNumber).toBe(1);
    expect(first.color).toBe("w");
    expect(first.san).toBe("e4");
    expect(first.uci).toBe("e2e4");
    expect(first.fenBefore).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    // chess.js 1.x solo reporta la casilla de al paso cuando es realmente
    // capturable; tras 1. e4 ningún peón negro puede capturarla, así que es "-".
    expect(first.fenAfter).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    );

    const second = game.positions[1]!;
    expect(second.color).toBe("b");
    expect(second.moveNumber).toBe(1);
    expect(second.san).toBe("e5");

    const third = game.positions[2]!;
    expect(third.moveNumber).toBe(2);
    expect(third.san).toBe("Nf3");
  });

  it("lee los tiempos de reloj embebidos en comentarios [%clk]", () => {
    const game = parsePgn(CHESSCOM_PGN);

    expect(game.positions[0]!.clockSeconds).toBe(598);
    expect(game.positions[1]!.clockSeconds).toBe(597);
    expect(game.positions[5]!.clockSeconds).toBe(592);
  });

  it("parsea partidas de Lichess con comentarios [%eval] y [%clk] combinados", () => {
    const game = parsePgn(LICHESS_PGN);

    expect(game.headers.white).toBe("alice");
    expect(game.headers.black).toBe("bob");
    expect(game.headers.result).toBe("0-1");
    expect(game.headers.opening).toBe("Scandinavian Defense");
    expect(game.positions).toHaveLength(4);
    expect(game.positions[0]!.clockSeconds).toBe(300);
    expect(game.positions[3]!.san).toBe("Qxd5");
  });

  it("usa '*' como resultado por defecto si el header falta o es desconocido", () => {
    const game = parsePgn(`[White "a"]\n[Black "b"]\n\n1. e4 e5 *`);
    expect(game.headers.result).toBe("*");
  });

  it("no incluye elo cuando el header no es numérico", () => {
    const game = parsePgn(
      `[White "a"]\n[Black "b"]\n[WhiteElo "?"]\n\n1. e4 e5 *`,
    );
    expect(game.headers.whiteElo).toBeUndefined();
  });
});
