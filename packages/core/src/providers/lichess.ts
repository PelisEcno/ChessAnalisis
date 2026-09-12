import { fetchWithRetry, HttpError } from "./http.js";

export interface LichessPlayerAnalysis {
  inaccuracy: number;
  mistake: number;
  blunder: number;
  acpl: number;
}

export interface LichessPlayer {
  user?: { name: string; id: string; title?: string };
  rating?: number;
  ratingDiff?: number;
  provisional?: boolean;
  analysis?: LichessPlayerAnalysis;
}

export interface LichessOpening {
  eco: string;
  name: string;
  ply: number;
}

export interface LichessClock {
  initial: number;
  increment: number;
  totalTime: number;
}

export interface LichessMoveAnalysis {
  /** Centipawns, perspectiva de blancas. Ausente si esta jugada es un mate forzado (ver `mate`). */
  eval?: number;
  /** Jugadas hasta el mate; ausente si esta jugada no es un mate forzado. */
  mate?: number;
  best?: string;
  variation?: string;
  judgment?: { name: string; comment: string };
}

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  perf: string;
  /** Epoch en milisegundos. */
  createdAt: number;
  /** Epoch en milisegundos. */
  lastMoveAt: number;
  status: string;
  source?: string;
  players: { white: LichessPlayer; black: LichessPlayer };
  winner?: "white" | "black";
  opening?: LichessOpening;
  /** Jugadas en SAN separadas por espacio (no viene si se pide pgnInJson y se ignora `moves`). */
  moves?: string;
  /** PGN completo con headers; solo viene si se pide con pgnInJson=true. */
  pgn?: string | undefined;
  /** Centésimas de segundo restantes tras cada jugada; solo con clocks=true. */
  clocks?: number[];
  analysis?: LichessMoveAnalysis[];
  clock?: LichessClock;
}

export interface LichessGamesParams {
  /** Cuántas partidas bajar como máximo. Sin límite si se omite. */
  max?: number;
  /** Uno o más de "ultraBullet","bullet","blitz","rapid","classical","correspondence", separados por coma. */
  perfType?: string;
  rated?: boolean;
  /** Epoch en ms. */
  since?: number;
  /** Epoch en ms. */
  until?: number;
  vs?: string;
  color?: "white" | "black";
  analysed?: boolean;
  opening?: boolean;
  evals?: boolean;
  clocks?: boolean;
  sort?: "dateAsc" | "dateDesc";
}

/**
 * TODO(fase futura): implementar el flujo OAuth2 + PKCE de Lichess
 * (https://lichess.org/api#tag/OAuth) para autenticar al usuario y acceder
 * a datos privados y a un throttle más alto (30-60 partidas/seg en vez de
 * 20 anónimo). Por ahora `auth` solo sirve para pasar un token ya obtenido
 * a mano; no hay forma de conseguirlo desde la app todavía.
 */
export interface LichessAuth {
  accessToken: string;
}

export interface LichessOptions {
  userAgent: string;
  auth?: LichessAuth;
}

const BASE_URL = "https://lichess.org";

function buildUrl(username: string, params: LichessGamesParams): string {
  const url = new URL(
    `${BASE_URL}/api/games/user/${encodeURIComponent(username)}`,
  );
  // pgnInJson y tags: siempre encendidos, es lo que permite reusar
  // pgn.ts (parsePgn) tal cual para normalizar partidas de ambas plataformas.
  url.searchParams.set("pgnInJson", "true");
  url.searchParams.set("tags", "true");

  if (params.max !== undefined) url.searchParams.set("max", String(params.max));
  if (params.perfType !== undefined)
    url.searchParams.set("perfType", params.perfType);
  if (params.rated !== undefined)
    url.searchParams.set("rated", String(params.rated));
  if (params.since !== undefined)
    url.searchParams.set("since", String(params.since));
  if (params.until !== undefined)
    url.searchParams.set("until", String(params.until));
  if (params.vs !== undefined) url.searchParams.set("vs", params.vs);
  if (params.color !== undefined) url.searchParams.set("color", params.color);
  if (params.analysed !== undefined)
    url.searchParams.set("analysed", String(params.analysed));
  if (params.opening !== undefined)
    url.searchParams.set("opening", String(params.opening));
  if (params.evals !== undefined)
    url.searchParams.set("evals", String(params.evals));
  if (params.clocks !== undefined)
    url.searchParams.set("clocks", String(params.clocks));
  if (params.sort !== undefined) url.searchParams.set("sort", params.sort);

  return url.toString();
}

/**
 * Descarga las partidas de un usuario como STREAM de NDJSON, entregando cada
 * partida a medida que llega (no carga la respuesta completa en memoria:
 * hay cuentas con más de 500.000 partidas). Lichess throttlea el stream:
 * ~20 partidas/seg sin autenticar, más con OAuth2.
 */
export async function* streamUserGames(
  username: string,
  params: LichessGamesParams,
  opts: LichessOptions,
): AsyncGenerator<LichessGame, void, void> {
  const url = buildUrl(username, params);

  const headers: Record<string, string> = {
    Accept: "application/x-ndjson",
    "User-Agent": opts.userAgent,
  };
  if (opts.auth) headers["Authorization"] = `Bearer ${opts.auth.accessToken}`;

  const response = await fetchWithRetry(url, { headers });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(response.status, url, body);
  }
  if (!response.body) {
    throw new Error(
      "La respuesta de Lichess no trae un body legible como stream.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) yield JSON.parse(line) as LichessGame;
      newlineIndex = buffer.indexOf("\n");
    }
  }

  const last = buffer.trim();
  if (last) yield JSON.parse(last) as LichessGame;
}

/** Conveniencia sobre streamUserGames para cuando sí se quiere el array completo. */
export async function getUserGames(
  username: string,
  params: LichessGamesParams,
  opts: LichessOptions,
): Promise<LichessGame[]> {
  const games: LichessGame[] = [];
  for await (const game of streamUserGames(username, params, opts)) {
    games.push(game);
  }
  return games;
}
