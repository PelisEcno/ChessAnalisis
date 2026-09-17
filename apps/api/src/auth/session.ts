import { randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { redis } from "../redis.js";

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 días

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  await redis.set(sessionKey(sessionId), userId, "EX", SESSION_TTL_SECONDS);
  return sessionId;
}

export async function getSessionUserId(
  sessionId: string | undefined,
): Promise<string | null> {
  if (!sessionId) return null;
  return redis.get(sessionKey(sessionId));
}

export async function destroySession(sessionId: string): Promise<void> {
  await redis.del(sessionKey(sessionId));
}

/**
 * httpOnly + SameSite=Lax: correcto para navegaciones completas (magic link,
 * callback de OAuth) desde el propio dominio de la API. Si más adelante el
 * front hace fetch() cross-origin directo contra la API con esta cookie,
 * hace falta SameSite=None + HTTPS, o pasar las llamadas por un proxy del
 * lado del servidor (como ya hace apps/web con /api/import en las fases
 * 3-4) para no depender de que el navegador adjunte cookies cross-site.
 */
export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionIdFromRequest(
  request: FastifyRequest,
): string | undefined {
  return request.cookies[SESSION_COOKIE];
}
