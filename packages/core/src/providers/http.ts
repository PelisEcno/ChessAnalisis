/**
 * Utilidades HTTP compartidas por los proveedores (chesscom.ts, lichess.ts).
 * Usan la `fetch` global (disponible tanto en navegador como en Node 18+),
 * no APIs específicas de ninguno de los dos entornos.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} en ${url}`);
    this.name = "HttpError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FetchWithRetryOptions {
  headers?: Record<string, string> | undefined;
  /** Máximo de reintentos ante 429 antes de rendirse. */
  maxRetries?: number;
  /** Base del backoff exponencial, en ms. */
  baseDelayMs?: number;
}

/**
 * fetch() con reintento ante 429 (Too Many Requests): si el servidor manda
 * `Retry-After`, espera exactamente eso; si no, backoff exponencial con
 * jitter. Cualquier otro status (2xx, 404, 500, etc.) se devuelve tal cual
 * para que decida quien llama.
 */
export async function fetchWithRetry(
  url: string,
  opts: FetchWithRetryOptions = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 1000;

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: opts.headers ?? {} });
    if (response.status !== 429 || attempt >= maxRetries) return response;

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : undefined;
    const backoffMs = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;

    await sleep(
      retryAfterMs !== undefined && Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : backoffMs,
    );
  }
}

export interface HttpCacheEntry {
  etag?: string | undefined;
  lastModified?: string | undefined;
  body: string;
}

export interface HttpCacheStore {
  get(
    key: string,
  ): HttpCacheEntry | undefined | Promise<HttpCacheEntry | undefined>;
  set(key: string, entry: HttpCacheEntry): void | Promise<void>;
}

/**
 * Caché en memoria del proceso: se pierde al recargar la página o reiniciar
 * el servidor. Es el valor por defecto porque es portable (no depende de
 * localStorage/IndexedDB/fs); para persistencia real entre reinicios, pasar
 * un HttpCacheStore propio (en el backend, fase 5, respaldado en Redis).
 */
export function createMemoryCacheStore(): HttpCacheStore {
  const map = new Map<string, HttpCacheEntry>();
  return {
    get: (key) => map.get(key),
    set: (key, entry) => {
      map.set(key, entry);
    },
  };
}

const defaultStore = createMemoryCacheStore();

/**
 * GET con caché condicional por ETag/Last-Modified (If-None-Match /
 * If-Modified-Since): si el servidor responde 304, reutiliza el cuerpo
 * cacheado en vez de volver a descargarlo. Tira HttpError en cualquier
 * respuesta que no sea 2xx o 304-con-caché.
 */
export async function cachedFetchText(
  url: string,
  opts: FetchWithRetryOptions & {
    cacheStore?: HttpCacheStore | undefined;
  } = {},
): Promise<string> {
  const store = opts.cacheStore ?? defaultStore;
  const cached = await store.get(url);

  const headers: Record<string, string> = { ...opts.headers };
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;

  const response = await fetchWithRetry(url, { ...opts, headers });

  if (response.status === 304 && cached) {
    return cached.body;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HttpError(response.status, url, body);
  }

  const body = await response.text();
  const etag = response.headers.get("etag") ?? undefined;
  const lastModified = response.headers.get("last-modified") ?? undefined;
  if (etag || lastModified) {
    await store.set(url, { etag, lastModified, body });
  }
  return body;
}
