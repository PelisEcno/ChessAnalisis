import fastifyOauth2 from "@fastify/oauth2";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { findOrCreateUserByEmail } from "../services/users.js";
import { emailSender } from "./email.js";
import { consumeMagicLinkToken, createMagicLinkToken } from "./magicLink.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionIdFromRequest,
  setSessionCookie,
} from "./session.js";

export const MagicLinkRequestSchema = z.object({ email: z.email() });

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/magic-link", async (request, reply) => {
    const parsed = MagicLinkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: z.prettifyError(parsed.error) });
    }

    const token = await createMagicLinkToken(parsed.data.email);
    const link = `${env.API_BASE_URL}/auth/magic-link/callback?token=${token}`;
    await emailSender.send(
      parsed.data.email,
      "Tu enlace para entrar a Peón Libre",
      `Hacé click para entrar (vence en 15 minutos): ${link}`,
    );

    return reply.send({ ok: true });
  });

  app.get("/auth/magic-link/callback", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const token = typeof query.token === "string" ? query.token : undefined;
    if (!token) return reply.code(400).send({ error: "Falta el token." });

    const email = await consumeMagicLinkToken(token);
    if (!email) {
      return reply
        .code(400)
        .send({ error: "El enlace venció o ya se usó. Pedí uno nuevo." });
    }

    const user = await findOrCreateUserByEmail(email);
    const sessionId = await createSession(user.id);
    setSessionCookie(reply, sessionId);
    return reply.redirect(env.WEB_ORIGIN);
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionId = getSessionIdFromRequest(request);
    if (sessionId) await destroySession(sessionId);
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  // Google OAuth solo se registra si hay credenciales configuradas: sin
  // ellas, @fastify/oauth2 llamaría igual al endpoint de discovery de Google
  // al arrancar y no tiene sentido en dev sin credenciales reales.
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    await app.register(fastifyOauth2, {
      name: "oauth2Google",
      scope: ["openid", "email", "profile"],
      credentials: {
        client: { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET },
        auth: fastifyOauth2.GOOGLE_CONFIGURATION,
      },
      discovery: { issuer: "https://accounts.google.com" },
      startRedirectPath: "/auth/google",
      callbackUri: `${env.API_BASE_URL}/auth/google/callback`,
      pkce: "S256",
    });

    app.get("/auth/google/callback", async (request, reply) => {
      const { token } =
        await app.oauth2Google!.getAccessTokenFromAuthorizationCodeFlow(
          request,
          reply,
        );
      const userinfo = (await app.oauth2Google!.userinfo(token)) as {
        email?: string;
      };
      if (!userinfo.email) {
        return reply.code(502).send({ error: "Google no devolvió un email." });
      }

      const user = await findOrCreateUserByEmail(userinfo.email);
      const sessionId = await createSession(user.id);
      setSessionCookie(reply, sessionId);
      return reply.redirect(env.WEB_ORIGIN);
    });
  } else {
    app.log.warn(
      "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no configurados: /auth/google deshabilitado.",
    );
  }
}
