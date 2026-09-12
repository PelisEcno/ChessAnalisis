import {
  getRecentGames as getChessComRecentGames,
  getUserGames as getLichessUserGames,
  normalizeGame,
  type NormalizedGame,
} from "@peon-libre/core";
import { NextResponse, type NextRequest } from "next/server";

// Chess.com y Lichess piden un User-Agent identificable con contacto (así
// pueden avisar si nos bloquean por error). Los navegadores no dejan que JS
// sobrescriba ese header, así que esta llamada tiene que hacerse desde el
// servidor: por eso este endpoint existe, en vez de llamar a los proveedores
// directo desde el cliente.
function buildUserAgent(): string {
  const contact = process.env.CONTACT_EMAIL;
  if (!contact) {
    console.warn(
      "CONTACT_EMAIL no está configurado (ver apps/web/.env.example). " +
        "Chess.com y Lichess piden un User-Agent con contacto real.",
    );
  }
  return `PeonLibre/0.1 (contact: ${contact ?? "no-configurado"})`;
}

interface GameSummary {
  source: NormalizedGame["source"];
  sourceId: string;
  url: string;
  rated: boolean;
  timeControl: string;
  endedAt: number;
  white: { name: string; rating: number | undefined };
  black: { name: string; rating: number | undefined };
  result: string;
  opening: { eco: string | undefined; name: string | undefined } | undefined;
}

function toSummary(normalized: NormalizedGame): GameSummary {
  const h = normalized.parsed.headers;
  return {
    source: normalized.source,
    sourceId: normalized.sourceId,
    url: normalized.url,
    rated: normalized.rated,
    timeControl: normalized.timeControl,
    endedAt: normalized.endedAt,
    white: { name: h.white, rating: h.whiteElo },
    black: { name: h.black, rating: h.blackElo },
    result: h.result,
    opening: (h.eco ?? h.opening) ? { eco: h.eco, name: h.opening } : undefined,
  };
}

const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string; username: string }> },
) {
  const { platform, username } = await params;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < MIN_LIMIT || limit > MAX_LIMIT) {
    return NextResponse.json(
      {
        error: `"limit" debe ser un entero entre ${MIN_LIMIT} y ${MAX_LIMIT}.`,
      },
      { status: 400 },
    );
  }

  const userAgent = buildUserAgent();

  try {
    let normalized: NormalizedGame[];

    if (platform === "chesscom") {
      const raw = await getChessComRecentGames(username, limit, { userAgent });
      normalized = raw.map((g) => normalizeGame(g, "chesscom"));
    } else if (platform === "lichess") {
      const raw = await getLichessUserGames(
        username,
        { max: limit, opening: true, clocks: true, sort: "dateDesc" },
        { userAgent },
      );
      normalized = raw.map((g) => normalizeGame(g, "lichess"));
    } else {
      return NextResponse.json(
        {
          error: `Plataforma desconocida: "${platform}". Usá "chesscom" o "lichess".`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ games: normalized.map(toSummary) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
