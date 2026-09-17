import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/requireAuth.js";
import { db } from "../db/client.js";
import { userStats } from "../db/schema.js";

/**
 * Estadísticas agregadas del usuario. El cálculo real (tendencias de
 * precisión, patrones de error, etc.) es de la fase 6 (insights.ts); acá
 * solo se expone lo que ya haya en user_stats.
 */
export async function registerStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/stats", { preHandler: requireAuth }, async (request, reply) => {
    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, request.userId!),
    });

    return reply.send(
      stats ?? {
        userId: request.userId,
        gamesAnalyzed: 0,
        avgAccuracy: null,
        updatedAt: null,
      },
    );
  });
}
