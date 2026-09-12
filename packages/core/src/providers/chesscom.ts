import { cachedFetchText, type HttpCacheStore } from "./http.js";

export interface ChessComPlayerResult {
  rating: number;
  result: string;
  "@id": string;
  username: string;
  uuid: string;
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  /** Epoch en segundos. */
  end_time: number;
  rated: boolean;
  accuracies?: { white: number; black: number };
  tcn: string;
  uuid: string;
  initial_setup: string;
  fen: string;
  time_class: string;
  rules: string;
  white: ChessComPlayerResult;
  black: ChessComPlayerResult;
  /** URL a la página de la apertura, no el código ECO (ese viene en el PGN). */
  eco?: string;
  tournament?: string;
  match?: string;
}

export interface ChessComOptions {
  /**
   * User-Agent identificable con contacto, según pide la política de
   * Chess.com ("si nos bloquean, así nos pueden avisar"). Solo tiene efecto
   * corriendo en Node/servidor: los navegadores no dejan que JS sobrescriba
   * este header, así que en el cliente se ignora en silencio.
   */
  userAgent: string;
  cacheStore?: HttpCacheStore;
}

const BASE_URL = "https://api.chess.com/pub";

interface ChessComErrorBody {
  code?: number;
  message?: string;
}

async function getJson<T>(url: string, opts: ChessComOptions): Promise<T> {
  const text = await cachedFetchText(url, {
    headers: { "User-Agent": opts.userAgent },
    cacheStore: opts.cacheStore,
  }).catch((error) => {
    throw translateError(error, url);
  });
  return JSON.parse(text) as T;
}

function translateError(error: unknown, url: string): Error {
  if (
    error &&
    typeof error === "object" &&
    "body" in error &&
    typeof (error as { body: unknown }).body === "string"
  ) {
    try {
      const parsed = JSON.parse(
        (error as { body: string }).body,
      ) as ChessComErrorBody;
      if (parsed.message)
        return new Error(`Chess.com (${url}): ${parsed.message}`);
    } catch {
      // el body no era JSON; seguimos con el error original
    }
  }
  return error as Error;
}

/** GET /pub/player/{username}/games/archives */
export async function getArchives(
  username: string,
  opts: ChessComOptions,
): Promise<string[]> {
  const data = await getJson<{ archives: string[] }>(
    `${BASE_URL}/player/${encodeURIComponent(username)}/games/archives`,
    opts,
  );
  return data.archives;
}

/** GET de una URL de archivo mensual (una de las que devuelve getArchives). */
export async function getMonthGames(
  archiveUrl: string,
  opts: ChessComOptions,
): Promise<ChessComGame[]> {
  const data = await getJson<{ games: ChessComGame[] }>(archiveUrl, opts);
  return data.games;
}

/**
 * Recorre los archivos mensuales del más reciente hacia atrás hasta juntar
 * `limit` partidas, devueltas de más reciente a más antigua.
 *
 * SIEMPRE serial (nunca Promise.all entre meses): el acceso serial a la API
 * de Chess.com no tiene límite, pero las peticiones en paralelo pueden
 * devolver 429.
 */
export async function getRecentGames(
  username: string,
  limit: number,
  opts: ChessComOptions,
): Promise<ChessComGame[]> {
  const archives = await getArchives(username, opts);
  const recent: ChessComGame[] = [];

  for (let i = archives.length - 1; i >= 0 && recent.length < limit; i--) {
    const archiveUrl = archives[i]!;
    const monthGames = await getMonthGames(archiveUrl, opts);
    // Dentro de un mes, la API los devuelve en orden ascendente (más vieja
    // primero), así que recorremos ese mes también de atrás hacia adelante.
    for (let j = monthGames.length - 1; j >= 0 && recent.length < limit; j--) {
      recent.push(monthGames[j]!);
    }
  }

  return recent;
}
