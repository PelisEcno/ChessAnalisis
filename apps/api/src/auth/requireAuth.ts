import type { FastifyReply, FastifyRequest } from "fastify";
import { getSessionIdFromRequest, getSessionUserId } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

/** preHandler para rutas protegidas: exige sesión válida y expone request.userId. */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionId = getSessionIdFromRequest(request);
  const userId = await getSessionUserId(sessionId);
  if (!userId) {
    await reply.code(401).send({ error: "No autenticado." });
    return;
  }
  request.userId = userId;
}
