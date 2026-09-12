import { parsePgn, type ParsedGame } from "../pgn.js";
import type { ChessComGame } from "./chesscom.js";
import type { LichessGame } from "./lichess.js";

export type GameSource = "chesscom" | "lichess";

/**
 * Forma común a la que se normalizan las partidas de ambas plataformas.
 * No se llama `ParsedGame` (aunque lo envuelve) porque necesita campos que
 * pgn.ts no tiene motivo para conocer: de qué plataforma vino, su id ahí, y
 * si ya trae evaluaciones de motor propias.
 */
export interface NormalizedGame {
  source: GameSource;
  /** Id de la partida en su plataforma de origen (uuid en Chess.com, id en Lichess). */
  sourceId: string;
  url: string;
  rated: boolean;
  /** Tal cual la reporta la plataforma (p.ej. "600" en Chess.com, "180+2" en Lichess). */
  timeControl: string;
  /** Epoch en milisegundos. */
  endedAt: number;
  parsed: ParsedGame;
  /** Si la plataforma ya trae evaluaciones de motor: nos ahorramos analizarla localmente. */
  hasProviderEvals: boolean;
}

function normalizeChessComGame(game: ChessComGame): NormalizedGame {
  return {
    source: "chesscom",
    sourceId: game.uuid,
    url: game.url,
    rated: game.rated,
    timeControl: game.time_control,
    endedAt: game.end_time * 1000,
    parsed: parsePgn(game.pgn),
    // El PGN de Chess.com no trae [%eval ...]: hay que analizarla localmente.
    hasProviderEvals: false,
  };
}

function normalizeLichessGame(game: LichessGame): NormalizedGame {
  if (!game.pgn) {
    throw new Error(
      `La partida de Lichess ${game.id} no trae PGN (pedí getUserGames/streamUserGames sin pgnInJson).`,
    );
  }

  return {
    source: "lichess",
    sourceId: game.id,
    url: `https://lichess.org/${game.id}`,
    rated: game.rated,
    timeControl: game.clock
      ? `${game.clock.initial}+${game.clock.increment}`
      : game.speed,
    endedAt: game.lastMoveAt,
    parsed: parsePgn(game.pgn),
    hasProviderEvals: Boolean(game.analysis?.length),
  };
}

export function normalizeGame(
  raw: ChessComGame | LichessGame,
  source: GameSource,
): NormalizedGame {
  return source === "chesscom"
    ? normalizeChessComGame(raw as ChessComGame)
    : normalizeLichessGame(raw as LichessGame);
}
