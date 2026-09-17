import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/requireAuth.js";
import { db } from "../db/client.js";
import { linkedAccounts, users } from "../db/schema.js";

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, request.userId!),
    });
    if (!user) return reply.code(404).send({ error: "Usuario no encontrado." });

    const accounts = await db.query.linkedAccounts.findMany({
      where: eq(linkedAccounts.userId, user.id),
    });

    return reply.send({
      id: user.id,
      email: user.email,
      linkedAccounts: accounts.map((a) => ({
        platform: a.platform,
        username: a.username,
      })),
    });
  });
}
