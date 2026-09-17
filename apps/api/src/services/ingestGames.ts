import {
  getRecentGames as getChessComRecentGames,
  getUserGames as getLichessUserGames,
  normalizeGame,
  type ChessComGame,
  type LichessGame,
  type NormalizedGame,
} from "@peon-libre/core";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { env } from "../env.js";
import { analysisQueue } from "../queues/analysis.js";
import { createRedisHttpCacheStore } from "./httpCache.js";

export type Platform = "chesscom" | "lichess";

const DEFAULT_ANALYSIS_DEPTH = 18;

// Cachea las respuestas de Chess.com (archives + meses) por ETag en Redis,
// compartido entre workers y reinicios (a diferencia del Map en memoria que
// packages/core usa por defecto si no le pasás un store).
const chessComCacheStore = createRedisHttpCacheStore("http-cache:chesscom");

function buildUserAgent(): string {
  return `PeonLibre/0.1 (contact: ${env.CONTACT_EMAIL})`;
}

/** Inserta la partida si no existía (deduplicada por source+sourceId). */
async function upsertGame(
  normalized: NormalizedGame,
  pgn: string,
): Promise<{ gameId: string; inserted: boolean }> {
  const existing = await db.query.games.findFirst({
    where: and(
      eq(games.source, normalized.source),
      eq(games.sourceId, normalized.sourceId),
    ),
  });
  if (existing) return { gameId: existing.id, inserted: false };

  const h = normalized.parsed.headers;
  const [row] = await db
    .insert(games)
    .values({
      source: normalized.source,
      sourceId: normalized.sourceId,
      pgn,
      url: normalized.url,
      white: h.white,
      black: h.black,
      whiteElo: h.whiteElo ?? null,
      blackElo: h.blackElo ?? null,
      result: h.result,
      rated: normalized.rated,
      timeControl: normalized.timeControl,
      eco: h.eco ?? null,
      opening: h.opening ?? null,
      endedAt: new Date(normalized.endedAt),
    })
    .onConflictDoNothing()
    .returning({ id: games.id });

  // Carrera con otro ingest concurrente: si onConflictDoNothing no insertó,
  // buscamos la fila que ya quedó guardada.
  if (!row) {
    const nowExisting = await db.query.games.findFirst({
      where: and(
        eq(games.source, normalized.source),
        eq(games.sourceId, normalized.sourceId),
      ),
    });
    return { gameId: nowExisting!.id, inserted: false };
  }

  return { gameId: row.id, inserted: true };
}

export interface IngestResult {
  found: number;
  inserted: number;
}

/**
 * Trae las partidas recientes de un usuario en una plataforma, las guarda
 * (deduplicadas) y encola el análisis de las que sean nuevas. No re-analiza
 * partidas que ya estaban guardadas.
 */
export async function ingestUserGames(
  platform: Platform,
  username: string,
  limit: number,
): Promise<IngestResult> {
  const userAgent = buildUserAgent();
  let inserted = 0;
  let found = 0;

  async function handle(normalized: NormalizedGame, pgn: string) {
    found += 1;
    const { gameId, inserted: wasInserted } = await upsertGame(normalized, pgn);
    if (wasInserted) {
      inserted += 1;
      await analysisQueue.add("analyze", {
        gameId,
        depth: DEFAULT_ANALYSIS_DEPTH,
      });
    }
  }

  if (platform === "chesscom") {
    const raw: ChessComGame[] = await getChessComRecentGames(username, limit, {
      userAgent,
      cacheStore: chessComCacheStore,
    });
    for (const g of raw) {
      await handle(normalizeGame(g, "chesscom"), g.pgn);
    }
  } else {
    const raw: LichessGame[] = await getLichessUserGames(
      username,
      { max: limit, opening: true, clocks: true, sort: "dateDesc" },
      { userAgent },
    );
    for (const g of raw) {
      await handle(normalizeGame(g, "lichess"), g.pgn ?? "");
    }
  }

  return { found, inserted };
}
