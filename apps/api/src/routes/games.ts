import { desc, eq, ilike, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth.js";
import { db } from "../db/client.js";
import { analyses, games, linkedAccounts } from "../db/schema.js";

export const GameReportParamsSchema = z.object({ id: z.uuid() });

export async function registerGamesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/games", { preHandler: requireAuth }, async (request, reply) => {
    const accounts = await db.query.linkedAccounts.findMany({
      where: eq(linkedAccounts.userId, request.userId!),
    });
    if (accounts.length === 0) return reply.send({ games: [] });

    // Los nombres de usuario de Chess.com/Lichess no distinguen mayúsculas.
    const matches = accounts.flatMap((a) => [
      ilike(games.white, a.username),
      ilike(games.black, a.username),
    ]);

    const rows = await db
      .select()
      .from(games)
      .where(or(...matches))
      .orderBy(desc(games.endedAt))
      .limit(100);

    return reply.send({ games: rows });
  });

  app.get(
    "/games/:id/report",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = GameReportParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: z.prettifyError(params.error) });
      }

      const game = await db.query.games.findFirst({
        where: eq(games.id, params.data.id),
      });
      if (!game)
        return reply.code(404).send({ error: "Partida no encontrada." });

      const analysis = await db.query.analyses.findFirst({
        where: eq(analyses.gameId, game.id),
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      });

      if (!analysis) return reply.code(202).send({ status: "pending" });

      return reply.send({
        status: "done",
        report: analysis.result,
        engineVersion: analysis.engineVersion,
        depth: analysis.depth,
      });
    },
  );
}
