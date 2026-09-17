import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth.js";
import { db } from "../db/client.js";
import { linkedAccounts } from "../db/schema.js";
import { ingestQueue } from "../queues/ingest.js";

export const ImportParamsSchema = z.object({
  platform: z.enum(["chesscom", "lichess"]),
  username: z.string().min(1).max(100),
});

export const ImportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function registerImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/import/:platform/:username",
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = ImportParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: z.prettifyError(params.error) });
      }
      const query = ImportQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ error: z.prettifyError(query.error) });
      }

      const { platform, username } = params.data;
      const { limit } = query.data;

      // Vincula (o actualiza) la cuenta de la plataforma para este usuario.
      await db
        .insert(linkedAccounts)
        .values({ userId: request.userId!, platform, username })
        .onConflictDoUpdate({
          target: [linkedAccounts.userId, linkedAccounts.platform],
          set: { username },
        });

      const job = await ingestQueue.add("ingest", {
        platform,
        username,
        limit,
      });

      return reply.code(202).send({ jobId: job.id });
    },
  );
}
