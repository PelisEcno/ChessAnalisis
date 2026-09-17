import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth/plugin.js";
import { env } from "./env.js";
import { registerRateLimit } from "./plugins/rateLimit.js";
import { registerGamesRoutes } from "./routes/games.js";
import { registerImportRoutes } from "./routes/import.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerStatsRoutes } from "./routes/stats.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // credentials:true + origin explícito (no "*") para que el front pueda
  // eventualmente mandar la cookie de sesión en requests cross-origin.
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await registerRateLimit(app);

  app.get("/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerMeRoutes(app);
  await registerGamesRoutes(app);
  await registerImportRoutes(app);
  await registerStatsRoutes(app);

  return app;
}
