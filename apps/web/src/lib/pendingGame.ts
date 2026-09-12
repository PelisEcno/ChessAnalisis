// Todavía no hay backend (fase 5) que guarde partidas por id: para pasar una
// partida elegida en / hacia /analysis se usa sessionStorage (vive solo
// mientras dura la pestaña, no hace falta persistirlo más que eso).
const KEY = "peon-libre:pending-game";

export interface PendingGame {
  pgn: string;
  source: "chesscom" | "lichess";
  sourceId: string;
  url: string;
  /** Nombre de usuario buscado, para saber de qué lado jugó en la partida. */
  perspectiveUsername: string;
}

export function savePendingGame(game: PendingGame): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // sessionStorage no disponible: /analysis va a mostrar el estado vacío.
  }
}

export function readPendingGame(): PendingGame | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingGame) : null;
  } catch {
    return null;
  }
}
