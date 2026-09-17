"use client";

import type { Color, GameReport } from "@peon-libre/core";
import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useState } from "react";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface VariationMove {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  color: Color;
}

export interface Variation {
  /** Índice de cursor de línea principal (0..mainMoves.length) desde donde arranca. */
  branchAtIndex: number;
  moves: VariationMove[];
}

export type Cursor =
  { kind: "main"; index: number } | { kind: "variation"; index: number };

/**
 * Maneja la navegación por una partida ya analizada: la línea principal
 * (report.moves) más, como mucho, UNA variante propia que el usuario arma
 * arrastrando piezas desde cualquier posición. No es un árbol completo de
 * variantes múltiples (eso sería mucho más UI para un beneficio marginal);
 * alcanza para "explorar libremente" y ver esa exploración en la lista de
 * jugadas como una línea anidada.
 */
export function useGameNavigation(report: GameReport | null) {
  const mainMoves = useMemo(() => report?.moves ?? [], [report]);
  const startFen = mainMoves[0]?.fenBefore ?? START_FEN;

  const [cursor, setCursor] = useState<Cursor>({ kind: "main", index: 0 });
  const [variation, setVariation] = useState<Variation | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  // Mientras el motor todavía está analizando y el usuario no tocó nada,
  // el tablero "sigue" en vivo la última jugada ya evaluada (ver
  // useGameAnalysis: report crece de a poco). Cualquier navegación manual
  // apaga el seguimiento, salvo volver al final (que lo reactiva).
  const [autoFollow, setAutoFollow] = useState(true);

  useEffect(() => {
    if (autoFollow) setCursor({ kind: "main", index: mainMoves.length });
  }, [autoFollow, mainMoves.length]);

  const mainFenAt = useCallback(
    (index: number): string =>
      index === 0 ? startFen : mainMoves[index - 1]!.fenAfter,
    [mainMoves, startFen],
  );

  const currentFen = useMemo(() => {
    if (cursor.kind === "main") return mainFenAt(cursor.index);
    if (!variation) return mainFenAt(0);
    return cursor.index === 0
      ? mainFenAt(variation.branchAtIndex)
      : variation.moves[cursor.index - 1]!.fenAfter;
  }, [cursor, mainFenAt, variation]);

  const lastMove = useMemo(() => {
    const uci =
      cursor.kind === "main"
        ? cursor.index > 0
          ? mainMoves[cursor.index - 1]!.uci
          : undefined
        : cursor.index > 0
          ? variation?.moves[cursor.index - 1]?.uci
          : undefined;
    return uci ? { from: uci.slice(0, 2), to: uci.slice(2, 4) } : null;
  }, [cursor, mainMoves, variation]);

  const canGoBack = cursor.index > 0;
  const canGoForward =
    cursor.kind === "main"
      ? cursor.index < mainMoves.length
      : Boolean(variation && cursor.index < variation.moves.length);

  const goToMain = useCallback(
    (index: number) => {
      setAutoFollow(false);
      setCursor({
        kind: "main",
        index: Math.max(0, Math.min(mainMoves.length, index)),
      });
    },
    [mainMoves.length],
  );

  const goToVariation = useCallback((index: number) => {
    setAutoFollow(false);
    setCursor({ kind: "variation", index });
  }, []);

  const goBack = useCallback(() => {
    setAutoFollow(false);
    setCursor((c) => ({ ...c, index: Math.max(0, c.index - 1) }));
  }, []);

  const goForward = useCallback(() => {
    setAutoFollow(false);
    setCursor((c) => {
      const max =
        c.kind === "main" ? mainMoves.length : (variation?.moves.length ?? 0);
      return { ...c, index: Math.min(max, c.index + 1) };
    });
  }, [mainMoves.length, variation]);

  const goStart = useCallback(() => {
    setAutoFollow(false);
    setCursor({ kind: "main", index: 0 });
  }, []);
  // Volver "al final" es también la forma de retomar el seguimiento en vivo
  // si el análisis todavía sigue corriendo.
  const goEnd = useCallback(() => {
    setAutoFollow(true);
    setCursor({ kind: "main", index: mainMoves.length });
  }, [mainMoves.length]);

  const flip = useCallback(
    () => setOrientation((o) => (o === "white" ? "black" : "white")),
    [],
  );

  const clearVariation = useCallback(() => {
    setVariation((current) => {
      if (current) setCursor({ kind: "main", index: current.branchAtIndex });
      return null;
    });
  }, []);

  /** Intenta jugar una jugada (arrastre en el tablero) desde la posición actual. */
  const tryPlayMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      setAutoFollow(false);
      const chess = new Chess(currentFen);
      let move;
      try {
        move = chess.move({ from, to, promotion: promotion ?? "q" });
      } catch {
        return false;
      }
      if (!move) return false;

      const uci = `${move.from}${move.to}${move.promotion ?? ""}`;

      // Si estamos en la línea principal y la jugada coincide con la que
      // realmente se jugó, seguimos por ahí: no hace falta crear variante.
      if (cursor.kind === "main" && cursor.index < mainMoves.length) {
        const expected = mainMoves[cursor.index]!;
        if (expected.uci === uci) {
          setCursor({ kind: "main", index: cursor.index + 1 });
          return true;
        }
      }

      const newMove: VariationMove = {
        san: move.san,
        uci,
        fenBefore: currentFen,
        fenAfter: chess.fen(),
        color: move.color,
      };

      if (cursor.kind === "variation" && variation) {
        const truncated = variation.moves.slice(0, cursor.index);
        const next: Variation = {
          ...variation,
          moves: [...truncated, newMove],
        };
        setVariation(next);
        setCursor({ kind: "variation", index: next.moves.length });
        return true;
      }

      const branchAtIndex = cursor.kind === "main" ? cursor.index : 0;
      const next: Variation = { branchAtIndex, moves: [newMove] };
      setVariation(next);
      setCursor({ kind: "variation", index: 1 });
      return true;
    },
    [currentFen, cursor, mainMoves, variation],
  );

  return {
    cursor,
    variation,
    orientation,
    currentFen,
    lastMove,
    canGoBack,
    canGoForward,
    goToMain,
    goToVariation,
    goBack,
    goForward,
    goStart,
    goEnd,
    flip,
    clearVariation,
    tryPlayMove,
  };
}
