export interface PlayerBarProps {
  name: string;
  color: "white" | "black";
  elo?: number | undefined;
  accuracy?: number | undefined;
  /** Si es el turno de este jugador en la posición actual. */
  toMove: boolean;
}

/**
 * Franja con el nombre y color de un jugador, arriba/abajo del tablero (como
 * en Chess.com/Lichess): sin esto no queda claro a simple vista quién es
 * quién, sobre todo cuando el tablero está volteado.
 */
export function PlayerBar({
  name,
  color,
  elo,
  accuracy,
  toMove,
}: PlayerBarProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors"
      style={{
        backgroundColor: toMove
          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
          : "transparent",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-[var(--panel-border)]"
          style={{
            backgroundColor: color === "white" ? "#f5f5f5" : "#262626",
          }}
        />
        <span className="truncate text-sm font-semibold">{name}</span>
        {elo !== undefined && (
          <span className="shrink-0 text-xs text-[var(--muted)]">{elo}</span>
        )}
        {toMove && (
          <span
            aria-label="Le toca mover"
            className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full"
            style={{ backgroundColor: "var(--accent)" }}
          />
        )}
      </div>
      {accuracy !== undefined && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: "var(--accent-strong)" }}
        >
          {accuracy.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
