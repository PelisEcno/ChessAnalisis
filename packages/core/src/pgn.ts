import { Chess } from "chess.js";
import type { Color } from "./types.js";

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export interface ParsedGameHeaders {
  event?: string | undefined;
  site?: string | undefined;
  date?: string | undefined;
  white: string;
  black: string;
  whiteElo?: number | undefined;
  blackElo?: number | undefined;
  result: GameResult;
  eco?: string | undefined;
  opening?: string | undefined;
  timeControl?: string | undefined;
  termination?: string | undefined;
  /** Todos los headers PGN tal cual vienen, incluyendo los específicos de cada plataforma. */
  raw: Record<string, string>;
}

export interface ParsedPosition {
  /** 1-indexado: 1 es la primera jugada de blancas, 2 la primera de negras, etc. */
  ply: number;
  /** Número de jugada "de libro" (1. e4 e5 2. Nf3 ... -> 1, 1, 2, 2). */
  moveNumber: number;
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** Segundos restantes en el reloj tras la jugada, si el PGN trae comentarios [%clk ...]. */
  clockSeconds?: number | undefined;
}

export interface ParsedGame {
  headers: ParsedGameHeaders;
  positions: ParsedPosition[];
}

const RESULTS = ["1-0", "0-1", "1/2-1/2", "*"] as const;

function toResult(value: string | undefined): GameResult {
  return (RESULTS as readonly string[]).includes(value ?? "")
    ? (value as GameResult)
    : "*";
}

function toElo(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Formato estándar de anotación de reloj embebido en comentarios PGN, usado
// tanto por Chess.com como por Lichess: {[%clk 0:09:58]} o { [%clk 0:09:58] }.
const CLOCK_PATTERN = /\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/;

function parseClockSeconds(comment: string | undefined): number | undefined {
  if (!comment) return undefined;
  const match = CLOCK_PATTERN.exec(comment);
  if (!match) return undefined;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * Parsea un PGN de Chess.com o Lichess a una representación normalizada.
 * Usa chess.js para validar jugadas y obtener el FEN antes/después de cada una.
 */
export function parsePgn(pgn: string): ParsedGame {
  const chess = new Chess();
  chess.loadPgn(pgn, { strict: false });

  const raw = chess.getHeaders();
  const headers: ParsedGameHeaders = {
    event: raw.Event,
    site: raw.Site,
    date: raw.Date,
    white: raw.White ?? "?",
    black: raw.Black ?? "?",
    whiteElo: toElo(raw.WhiteElo),
    blackElo: toElo(raw.BlackElo),
    result: toResult(raw.Result),
    eco: raw.ECO,
    opening: raw.Opening,
    timeControl: raw.TimeControl,
    termination: raw.Termination,
    raw,
  };

  // Los comentarios inline (p.ej. [%clk ...]) quedan indexados por chess.js
  // según el FEN de la posición resultante de la jugada a la que pertenecen.
  const commentsByFen = new Map(
    chess.getComments().map((c) => [c.fen, c.comment]),
  );
  const moves = chess.history({ verbose: true });

  const positions: ParsedPosition[] = moves.map((move, index) => ({
    ply: index + 1,
    moveNumber: Math.floor(index / 2) + 1,
    color: move.color,
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    fenBefore: move.before,
    fenAfter: move.after,
    clockSeconds: parseClockSeconds(commentsByFen.get(move.after)),
  }));

  return { headers, positions };
}
