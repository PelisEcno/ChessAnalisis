"use client";

import { Chessboard } from "react-chessboard";
import type { CSSProperties } from "react";

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
}

const LAST_MOVE_STYLE: CSSProperties = {
  backgroundColor:
    "color-mix(in srgb, var(--board-last-move) 55%, transparent)",
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
}: BoardProps) {
  const squareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = LAST_MOVE_STYLE;
    squareStyles[lastMove.to] = LAST_MOVE_STYLE;
  }

  return (
    <div className="aspect-square w-full select-none">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          squareStyles,
          arrows: arrows?.map((a) => ({
            startSquare: a.from,
            endSquare: a.to,
            color: a.color ?? "rgba(21,150,90,0.8)",
          })),
          onPieceDrop: onPieceDrop
            ? ({ sourceSquare, targetSquare }) =>
                targetSquare ? onPieceDrop(sourceSquare, targetSquare) : false
            : undefined,
          darkSquareStyle: { backgroundColor: "var(--board-dark)" },
          lightSquareStyle: { backgroundColor: "var(--board-light)" },
          showNotation: true,
        }}
      />
    </div>
  );
}
