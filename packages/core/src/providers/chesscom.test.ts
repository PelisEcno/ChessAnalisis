import { beforeEach, describe, expect, it, vi } from "vitest";
import archivesFixture from "./__fixtures__/chesscom-archives.json";
import monthFixture from "./__fixtures__/chesscom-month.json";
import type { ChessComGame } from "./chesscom.js";

const cachedFetchText = vi.fn<(url: string) => Promise<string>>();
vi.mock("./http.js", () => ({
  cachedFetchText: (...args: [string]) => cachedFetchText(...args),
}));

const { getArchives, getMonthGames, getRecentGames } =
  await import("./chesscom.js");

const OPTS = { userAgent: "test-agent (contact: test@example.com)" };

describe("chesscom provider", () => {
  beforeEach(() => {
    cachedFetchText.mockReset();
  });

  it("getArchives devuelve la lista de URLs de archivos mensuales", async () => {
    cachedFetchText.mockResolvedValue(JSON.stringify(archivesFixture));

    const archives = await getArchives("hikaru", OPTS);

    expect(archives).toEqual(archivesFixture.archives);
    expect(cachedFetchText).toHaveBeenCalledWith(
      "https://api.chess.com/pub/player/hikaru/games/archives",
      expect.anything(),
    );
  });

  it("getMonthGames devuelve las partidas de un archivo mensual", async () => {
    cachedFetchText.mockResolvedValue(JSON.stringify(monthFixture));

    const games = await getMonthGames(
      "https://api.chess.com/pub/player/hikaru/games/2026/09",
      OPTS,
    );

    expect(games).toHaveLength(monthFixture.games.length);
    expect(games[0]!.uuid).toBe(monthFixture.games[0]!.uuid);
  });

  it("getRecentGames junta partidas del mes más reciente hacia atrás, sin pasarse del límite", async () => {
    cachedFetchText.mockImplementation((url: string) => {
      if (url.endsWith("archives"))
        return Promise.resolve(JSON.stringify(archivesFixture));
      if (url.endsWith("2026/09"))
        return Promise.resolve(JSON.stringify(monthFixture));
      throw new Error(
        `No debería pedir ${url} si ya juntó suficientes partidas`,
      );
    });

    const games = await getRecentGames("hikaru", 1, OPTS);

    expect(games).toHaveLength(1);
    // El mes viene en orden ascendente (más vieja primero): la más reciente
    // de setiembre es la última del fixture.
    const lastGameOfMonth = monthFixture.games[
      monthFixture.games.length - 1
    ] as ChessComGame;
    expect(games[0]!.uuid).toBe(lastGameOfMonth.uuid);
    // Solo debió pedir archives + el mes más reciente, nunca julio/agosto.
    expect(cachedFetchText).toHaveBeenCalledTimes(2);
  });

  it("getRecentGames sigue hacia meses anteriores si hace falta más partidas", async () => {
    const olderMonthFixture = {
      games: [{ ...monthFixture.games[0], uuid: "older-game-uuid" }],
    };

    cachedFetchText.mockImplementation((url: string) => {
      if (url.endsWith("archives"))
        return Promise.resolve(JSON.stringify(archivesFixture));
      if (url.endsWith("2026/09"))
        return Promise.resolve(JSON.stringify(monthFixture));
      if (url.endsWith("2026/08"))
        return Promise.resolve(JSON.stringify(olderMonthFixture));
      throw new Error(`No debería llegar a pedir ${url}`);
    });

    const games = await getRecentGames(
      "hikaru",
      monthFixture.games.length + 1,
      OPTS,
    );

    expect(games).toHaveLength(monthFixture.games.length + 1);
    expect(games[games.length - 1]!.uuid).toBe("older-game-uuid");
  });

  it("traduce el error de usuario no encontrado a un mensaje legible", async () => {
    cachedFetchText.mockRejectedValue(
      Object.assign(new Error("HTTP 404"), {
        body: JSON.stringify({ code: 0, message: 'User "nadie" not found.' }),
      }),
    );

    await expect(getArchives("nadie", OPTS)).rejects.toThrow(/not found/);
  });
});
