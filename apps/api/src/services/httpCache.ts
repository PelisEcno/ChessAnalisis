import type { HttpCacheEntry, HttpCacheStore } from "@peon-libre/core";
import { redis } from "../redis.js";

// Los endpoints de Chess.com se refrescan como mucho cada 12h (ver
// packages/core/src/providers/chesscom.ts); no tiene sentido cachear por
// más tiempo que eso.
const TTL_SECONDS = 60 * 60 * 12;

/**
 * HttpCacheStore (de packages/core/src/providers/http.ts) respaldado en
 * Redis: sin esto, chesscom.ts usa un Map en memoria del proceso que se
 * pierde con cada reinicio del worker.
 */
export function createRedisHttpCacheStore(prefix: string): HttpCacheStore {
  return {
    async get(key) {
      const raw = await redis.get(`${prefix}:${key}`);
      return raw ? (JSON.parse(raw) as HttpCacheEntry) : undefined;
    },
    async set(key, entry) {
      await redis.set(
        `${prefix}:${key}`,
        JSON.stringify(entry),
        "EX",
        TTL_SECONDS,
      );
    },
  };
}
