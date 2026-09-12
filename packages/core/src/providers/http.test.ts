import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedFetchText,
  createMemoryCacheStore,
  fetchWithRetry,
  HttpError,
} from "./http.js";

function textResponse(body: string | null, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

describe("fetchWithRetry", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve la respuesta directamente si no es 429", async () => {
    mockFetch.mockResolvedValue(textResponse("ok", { status: 200 }));

    const res = await fetchWithRetry("https://example.com");

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reintenta ante 429 y devuelve el resultado si el reintento funciona", async () => {
    mockFetch
      .mockResolvedValueOnce(textResponse(null, { status: 429 }))
      .mockResolvedValueOnce(textResponse("ok", { status: 200 }));

    const res = await fetchWithRetry("https://example.com", {
      baseDelayMs: 1,
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("respeta el header Retry-After si el servidor lo manda", async () => {
    mockFetch
      .mockResolvedValueOnce(
        textResponse("", { status: 429, headers: { "Retry-After": "0" } }),
      )
      .mockResolvedValueOnce(textResponse("ok", { status: 200 }));

    const res = await fetchWithRetry("https://example.com", {
      baseDelayMs: 10_000, // si no respetara Retry-After, el test tardaría
    });

    expect(res.status).toBe(200);
  });

  it("se rinde después de maxRetries y devuelve el último 429", async () => {
    mockFetch.mockResolvedValue(textResponse(null, { status: 429 }));

    const res = await fetchWithRetry("https://example.com", {
      maxRetries: 2,
      baseDelayMs: 1,
    });

    expect(res.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(3); // intento inicial + 2 reintentos
  });
});

describe("cachedFetchText", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cachea por ETag y reutiliza el cuerpo ante un 304", async () => {
    const store = createMemoryCacheStore();
    mockFetch
      .mockResolvedValueOnce(
        textResponse("contenido-v1", { status: 200, headers: { ETag: "abc" } }),
      )
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        const headers = init.headers as Record<string, string>;
        expect(headers["If-None-Match"]).toBe("abc");
        return Promise.resolve(textResponse(null, { status: 304 }));
      });

    const first = await cachedFetchText("https://example.com/x", {
      cacheStore: store,
    });
    const second = await cachedFetchText("https://example.com/x", {
      cacheStore: store,
    });

    expect(first).toBe("contenido-v1");
    expect(second).toBe("contenido-v1");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("tira HttpError en respuestas que no son 2xx", async () => {
    mockFetch.mockResolvedValue(
      textResponse('{"message":"nope"}', { status: 404 }),
    );

    await expect(
      cachedFetchText("https://example.com/y", {
        cacheStore: createMemoryCacheStore(),
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
