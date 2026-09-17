"use client";

import type { MoveLabel } from "@peon-libre/core";
import { Chessboard } from "react-chessboard";
import { useCallback, useMemo, type CSSProperties } from "react";
import { MOVE_LABEL_META } from "@/lib/moveLabels";

export interface BoardArrow {
  from: string;
  to: string;
  color?: string;
}

export interface BoardProps {
  fen: string;
  orientation?: "white" | "black";
  /** Si se puede arrastrar piezas para explorar (siempre validado por quien llama). */
  interactive?: boolean;
  onPieceDrop?: (from: string, to: string, promotion?: string) => boolean;
  lastMove?: { from: string; to: string } | null;
  arrows?: BoardArrow[];
  /** Etiqueta de calidad (brillante, error, ...) a mostrar sobre la casilla destino de la última jugada. */
  moveBadge?: { square: string; label: MoveLabel } | null;
}

const LAST_MOVE_STYLE: CSSProperties = {
  backgroundColor:
    "color-mix(in srgb, var(--board-last-move) 55%, transparent)",
};

// Objetos estables a nivel de módulo (no dependen de props): react-chessboard
// puede usar la identidad de estos campos de `options` en sus propios efectos
// internos, y pasarle uno nuevo en cada render (aunque el contenido sea
// idéntico) le puede confundir el manejo de animaciones cuando `position`
// cambia muy seguido, como al "seguir" una partida mientras se analiza.
const DARK_SQUARE_STYLE: CSSProperties = {
  backgroundColor: "var(--board-dark)",
};
const LIGHT_SQUARE_STYLE: CSSProperties = {
  backgroundColor: "var(--board-light)",
};

/**
 * Wrapper fino sobre react-chessboard (MIT). No usa chessground: aunque el
 * prompt original lo pedía, chessground es GPLv3 real (su propio README
 * exige liberar el código fuente del sitio que lo use), a diferencia de
 * Stockfish que corre aislado en un Worker. react-chessboard cubre lo mismo
 * sin esa obligación. Usa el set de piezas propio de la librería (parte del
 * paquete MIT), nunca assets de Chess.com.
 */
export function Board({
  fen,
  orientation = "white",
  interactive = false,
  onPieceDrop,
  lastMove,
  arrows,
  moveBadge,
}: BoardProps) {
  const squareStyles = useMemo(() => {
    if (!lastMove) return {};
    return {
      [lastMove.from]: LAST_MOVE_STYLE,
      [lastMove.to]: LAST_MOVE_STYLE,
    };
  }, [lastMove]);

  const mappedArrows = useMemo(
    () =>
      arrows?.map((a) => ({
        startSquare: a.from,
        endSquare: a.to,
        color: a.color ?? "rgba(21,150,90,0.8)",
      })),
    [arrows],
  );

  const handlePieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) =>
      onPieceDrop && targetSquare
        ? onPieceDrop(sourceSquare, targetSquare)
        : false,
    [onPieceDrop],
  );

  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: React.ReactNode }) => (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          ...squareStyles[square],
        }}
      >
        {children}
        {moveBadge?.square === square && <MoveBadge label={moveBadge.label} />}
      </div>
    ),
    [squareStyles, moveBadge],
  );

  return (
    <div className="aspect-square w-full select-none">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          squareStyles,
          animationDurationInMs: 220,
          arrows: mappedArrows,
          onPieceDrop: onPieceDrop ? handlePieceDrop : undefined,
          darkSquareStyle: DARK_SQUARE_STYLE,
          lightSquareStyle: LIGHT_SQUARE_STYLE,
          showNotation: true,
          squareRenderer,
        }}
      />
    </div>
  );
}

/** Insignia circular sobre la casilla destino, al estilo "game review" de las apps de ajedrez. */
function MoveBadge({ label }: { label: MoveLabel }) {
  const meta = MOVE_LABEL_META[label];
  if (!meta.glyph) return null;
  return (
    <div
      className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 flex h-[38%] min-h-4 w-[38%] min-w-4 items-center justify-center rounded-full text-[0.6em] font-bold text-white ring-2 ring-[var(--panel)]"
      style={{ backgroundColor: meta.color, boxShadow: "var(--elevation-2)" }}
      title={meta.text}
    >
      {meta.glyph}
    </div>
  );
}
