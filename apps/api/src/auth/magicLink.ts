import { randomBytes } from "node:crypto";
import { redis } from "../redis.js";

const MAGIC_LINK_TTL_SECONDS = 60 * 15; // 15 minutos

function magicLinkKey(token: string): string {
  return `magic-link:${token}`;
}

export async function createMagicLinkToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await redis.set(magicLinkKey(token), email, "EX", MAGIC_LINK_TTL_SECONDS);
  return token;
}

/** Un solo uso: si el token es válido, lo borra al consumirlo. */
export async function consumeMagicLinkToken(
  token: string,
): Promise<string | null> {
  const key = magicLinkKey(token);
  const email = await redis.get(key);
  if (email) await redis.del(key);
  return email;
}
