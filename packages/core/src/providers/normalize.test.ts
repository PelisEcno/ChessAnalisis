import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ChessComGame } from "./chesscom.js";
import monthFixture from "./__fixtures__/chesscom-month.json";
import type { LichessGame } from "./lichess.js";
import { normalizeGame } from "./normalize.js";

const here = dirname(fileURLToPath(import.meta.url));
const lichessGame = JSON.parse(
  readFileSync(join(here, "__fixtures__/lichess-games.ndjson"), "utf8")
    .trim()
    .split("\n")[0]!,
) as LichessGame;

describe("normalizeGame", () => {
  it("normaliza una partida de Chess.com", () => {
    const raw = monthFixture.games[0] as ChessComGame;
    const normalized = normalizeGame(raw, "chesscom");

    expect(normalized.source).toBe("chesscom");
    expect(normalized.sourceId).toBe(raw.uuid);
    expect(normalized.url).toBe(raw.url);
    expect(normalized.rated).toBe(raw.rated);
    expect(normalized.timeControl).toBe(raw.time_control);
    expect(normalized.endedAt).toBe(raw.end_time * 1000);
    expect(normalized.hasProviderEvals).toBe(false);
    expect(normalized.parsed.headers.white).toBe(raw.white.username);
    expect(normalized.parsed.positions.length).toBeGreaterThan(0);
  });

  it("normaliza una partida de Lichess (con pgn embebido)", () => {
    const normalized = normalizeGame(lichessGame, "lichess");

    expect(normalized.source).toBe("lichess");
    expect(normalized.sourceId).toBe(lichessGame.id);
    expect(normalized.url).toBe(`https://lichess.org/${lichessGame.id}`);
    expect(normalized.rated).toBe(lichessGame.rated);
    expect(normalized.parsed.positions.length).toBeGreaterThan(0);
    expect(normalized.parsed.positions[0]!.clockSeconds).toBeDefined();
  });

  it("tira un error claro si a la partida de Lichess le falta el PGN", () => {
    const withoutPgn: LichessGame = { ...lichessGame, pgn: undefined };
    expect(() => normalizeGame(withoutPgn, "lichess")).toThrow(/PGN/);
  });
});
