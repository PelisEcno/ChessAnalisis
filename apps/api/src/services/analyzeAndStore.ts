import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { analyses, games, moveLabels } from "../db/schema.js";
import { getEngineVersion } from "../engine/engineVersion.js";
import { analyzeGamePgn } from "./analyzeGame.js";

/**
 * Analiza una partida ya guardada y persiste el resultado. Nunca re-analiza
 * si ya existe un análisis con la misma versión de motor y profundidad
 * (unique constraint en la tabla, pero chequeamos antes para no gastar
 * tiempo de motor si ya sabemos que no hace falta).
 */
export async function analyzeAndStoreGame(
  gameId: string,
  depth: number,
): Promise<void> {
  const engineVersion = await getEngineVersion();

  const existing = await db.query.analyses.findFirst({
    where: and(
      eq(analyses.gameId, gameId),
      eq(analyses.engineVersion, engineVersion),
      eq(analyses.depth, depth),
    ),
  });
  if (existing) return;

  const game = await db.query.games.findFirst({
    where: eq(games.id, gameId),
  });
  if (!game) throw new Error(`Partida ${gameId} no encontrada.`);

  const report = await analyzeGamePgn(game.pgn, depth);

  const [analysisRow] = await db
    .insert(analyses)
    .values({ gameId, engineVersion, depth, result: report })
    .onConflictDoNothing()
    .returning({ id: analyses.id });

  if (!analysisRow) return; // otro worker lo insertó mientras tanto

  if (report.moves.length > 0) {
    await db.insert(moveLabels).values(
      report.moves.map((m) => ({
        analysisId: analysisRow.id,
        ply: m.ply,
        color: m.color,
        label: m.label,
        deltaWin: m.deltaWin,
        cpLoss: m.cpLoss,
        phase: m.phase,
      })),
    );
  }
}
