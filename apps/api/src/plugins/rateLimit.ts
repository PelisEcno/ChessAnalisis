import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { getSessionIdFromRequest, getSessionUserId } from "../auth/session.js";
import { redis } from "../redis.js";

/**
 * Rate limit global: por usuario si hay sesión, si no por IP. Usa el mismo
 * Redis que las colas para guardar los contadores (persiste entre reinicios
 * del proceso, y es compartido si corren varias instancias del API).
 */
export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis,
    keyGenerator: async (request) => {
      const sessionId = getSessionIdFromRequest(request);
      const userId = sessionId ? await getSessionUserId(sessionId) : null;
      return userId ?? request.ip;
    },
  });
}
