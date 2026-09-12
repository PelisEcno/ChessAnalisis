"use client";

import { useState } from "react";

type Platform = "chesscom" | "lichess";

interface GameSummary {
  source: Platform;
  sourceId: string;
  url: string;
  rated: boolean;
  timeControl: string;
  endedAt: number;
  white: { name: string; rating?: number };
  black: { name: string; rating?: number };
  result: string;
  opening?: { eco?: string; name?: string };
}

const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(platform: Platform, username: string, limit: number): string {
  return `peon-libre:import:${platform}:${username.toLowerCase()}:${limit}`;
}

function readCache(key: string): GameSummary[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt, games } = JSON.parse(raw) as {
      savedAt: number;
      games: GameSummary[];
    };
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return games;
  } catch {
    return null;
  }
}

function writeCache(key: string, games: GameSummary[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), games }));
  } catch {
    // localStorage no disponible (modo privado, cuota llena, etc.): no pasa nada.
  }
}

function outcomeFor(
  result: string,
  color: "w" | "b",
): "gana" | "pierde" | "tablas" | "?" {
  if (result === "1/2-1/2") return "tablas";
  if (result !== "1-0" && result !== "0-1") return "?";
  const whiteWon = result === "1-0";
  return (whiteWon && color === "w") || (!whiteWon && color === "b")
    ? "gana"
    : "pierde";
}

const OUTCOME_STYLES: Record<string, string> = {
  gana: "text-emerald-400",
  pierde: "text-red-400",
  tablas: "text-neutral-400",
  "?": "text-neutral-500",
};

export default function Home() {
  const [platform, setPlatform] = useState<Platform>("chesscom");
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [searchedUsername, setSearchedUsername] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    const limit = 20;
    const key = cacheKey(platform, trimmed, limit);
    const cached = readCache(key);
    if (cached) {
      setGames(cached);
      setSearchedUsername(trimmed);
      setStatus("idle");
      setError(null);
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(
        `/api/import/${platform}/${encodeURIComponent(trimmed)}?limit=${limit}`,
      );
      const data = (await res.json()) as {
        games?: GameSummary[];
        error?: string;
      };
      if (!res.ok || !data.games) {
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setGames(data.games);
      setSearchedUsername(trimmed);
      writeCache(key, data.games);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Peón Libre</h1>
        <p className="mt-2 text-neutral-400">
          Analizá tus partidas de Chess.com o Lichess con Stockfish, gratis.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex gap-2">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="chesscom">Chess.com</option>
            <option value="lichess">Lichess</option>
          </select>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="nombre de usuario"
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={status === "loading" || !username.trim()}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "loading" ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {games && (
          <ul className="mt-8 divide-y divide-neutral-800 border-t border-neutral-800">
            {games.length === 0 && (
              <li className="py-4 text-sm text-neutral-500">
                No encontré partidas recientes para &quot;{searchedUsername}
                &quot;.
              </li>
            )}
            {games.map((game) => {
              const isWhite =
                game.white.name.toLowerCase() ===
                searchedUsername.toLowerCase();
              const me = isWhite ? game.white : game.black;
              const opponent = isWhite ? game.black : game.white;
              const outcome = outcomeFor(game.result, isWhite ? "w" : "b");

              return (
                <li
                  key={game.sourceId}
                  className="flex items-center gap-4 py-3"
                >
                  <span
                    className={`w-14 shrink-0 text-sm font-medium ${OUTCOME_STYLES[outcome]}`}
                  >
                    {outcome}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      vs <span className="font-medium">{opponent.name}</span>{" "}
                      {opponent.rating && (
                        <span className="text-neutral-500">
                          ({opponent.rating})
                        </span>
                      )}
                      {me.rating && (
                        <span className="text-neutral-600">
                          {" "}
                          · vos: {me.rating}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {game.opening?.name ??
                        game.opening?.eco ??
                        "Apertura desconocida"}{" "}
                      · {game.timeControl} ·{" "}
                      {game.rated ? "clasificatoria" : "amistosa"} ·{" "}
                      {new Date(game.endedAt).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <a
                    href={game.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-emerald-500 hover:underline"
                  >
                    ver
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
