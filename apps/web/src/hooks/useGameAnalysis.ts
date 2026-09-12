"use client";

import {
  buildGameReport,
  parsePgn,
  type EngineResult,
  type GameReport,
  type ParsedGame,
} from "@peon-libre/core";
import { useEffect, useRef, useState } from "react";
import { EnginePool, type EngineProfile } from "@/engine/pool";

export type AnalysisStatus =
  "idle" | "analyzing" | "done" | "error" | "cancelled";

export interface AnalysisProgress {
  done: number;
  total: number;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Parsea un PGN y lo analiza posición por posición con el motor, emitiendo
 * un GameReport parcial a medida que van llegando resultados (no espera a
 * que termine toda la partida para mostrar algo).
 */
export function useGameAnalysis(
  pgn: string | null,
  profile: EngineProfile = "normal",
) {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState<AnalysisProgress>({
    done: 0,
    total: 0,
  });
  const [report, setReport] = useState<GameReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poolRef = useRef<EnginePool | null>(null);

  useEffect(() => {
    setReport(null);
    setError(null);
    setProgress({ done: 0, total: 0 });

    if (!pgn) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const pool = new EnginePool();
    poolRef.current = pool;
    setStatus("analyzing");

    async function run() {
      try {
        const game: ParsedGame = parsePgn(pgn!);
        const fens = [
          game.positions[0]?.fenBefore ?? START_FEN,
          ...game.positions.map((p) => p.fenAfter),
        ];
        const total = fens.length;
        setProgress({ done: 0, total });

        const results: EngineResult[] = new Array(total);

        await pool.analyzeGame(fens, {
          profile,
          multiPV: 3,
          onProgress: (done) => {
            if (!cancelled) setProgress({ done, total });
          },
          onResult: (index, result) => {
            results[index] = result;
            if (cancelled) return;

            // Los resultados llegan en orden estricto (el pool es secuencial),
            // así que en este punto siempre están completos 0..index.
            const doneUpTo = index + 1;
            if (doneUpTo < 2) return;

            const partialGame: ParsedGame = {
              ...game,
              positions: game.positions.slice(0, doneUpTo - 1),
            };
            try {
              setReport(
                buildGameReport(partialGame, results.slice(0, doneUpTo)),
              );
            } catch {
              // No debería pasar, pero un reporte parcial fallido no es fatal.
            }
          },
        });

        if (cancelled) return;
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }

    void run();

    return () => {
      cancelled = true;
      pool.dispose();
    };
  }, [pgn, profile]);

  function cancel() {
    poolRef.current?.cancel();
    setStatus("cancelled");
  }

  return { status, progress, report, error, cancel };
}
