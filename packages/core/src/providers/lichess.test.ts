import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const ndjsonFixture = readFileSync(
  join(here, "__fixtures__/lichess-games.ndjson"),
  "utf8",
);

const fetchWithRetry = vi.fn<(url: string) => Promise<Response>>();
vi.mock("./http.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./http.js")>();
  return {
    ...actual,
    fetchWithRetry: (...args: [string]) => fetchWithRetry(...args),
  };
});

const { streamUserGames, getUserGames } = await import("./lichess.js");

const OPTS = { userAgent: "test-agent (contact: test@example.com)" };

describe("lichess provider", () => {
  beforeEach(() => {
    fetchWithRetry.mockReset();
  });

  it("streamUserGames parsea el NDJSON línea por línea", async () => {
    fetchWithRetry.mockResolvedValue(
      new Response(ndjsonFixture, { status: 200 }),
    );

    const games = [];
    for await (const game of streamUserGames("DrNykterstein", {}, OPTS)) {
      games.push(game);
    }

    const expectedCount = ndjsonFixture.trim().split("\n").length;
    expect(games).toHaveLength(expectedCount);
    expect(games[0]!.id).toBeTruthy();
    expect(typeof games[0]!.pgn).toBe("string");
  });

  it("getUserGames junta el stream completo en un array", async () => {
    fetchWithRetry.mockResolvedValue(
      new Response(ndjsonFixture, { status: 200 }),
    );

    const games = await getUserGames("DrNykterstein", { max: 2 }, OPTS);

    expect(games.length).toBeGreaterThan(0);
  });

  it("arma la URL con pgnInJson/tags siempre encendidos y los parámetros pedidos", async () => {
    fetchWithRetry.mockResolvedValue(new Response("", { status: 200 }));

    await getUserGames(
      "DrNykterstein",
      { max: 5, perfType: "blitz,rapid", rated: true },
      OPTS,
    );

    const calledUrl = new URL(fetchWithRetry.mock.calls[0]![0]);
    expect(calledUrl.pathname).toBe("/api/games/user/DrNykterstein");
    expect(calledUrl.searchParams.get("pgnInJson")).toBe("true");
    expect(calledUrl.searchParams.get("tags")).toBe("true");
    expect(calledUrl.searchParams.get("max")).toBe("5");
    expect(calledUrl.searchParams.get("perfType")).toBe("blitz,rapid");
    expect(calledUrl.searchParams.get("rated")).toBe("true");
  });

  it("tira un error legible si el usuario no existe (404)", async () => {
    fetchWithRetry.mockResolvedValue(
      new Response('{"error":"Not found"}', { status: 404 }),
    );

    await expect(getUserGames("nadie", {}, OPTS)).rejects.toThrow();
  });
});
