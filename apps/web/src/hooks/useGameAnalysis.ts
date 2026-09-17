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
  profile: EngineProfile = "fast",
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

    // Con varios workers en paralelo (y sobre todo si la partida ya está
    // cacheada entera de un análisis anterior), los resultados pueden
    // llegar mucho más rápido de lo que React tarda en asentar un render:
    // volcar cada uno directo a setState puede encadenar renders más
    // rápido de lo que el navegador llega a confirmarlos, lo que React
    // interpreta como actualizaciones anidadas sin fin. Por eso acá se
    // juntan en variables y se aplican de a una vez por frame con
    // requestAnimationFrame, que corre fuera del ciclo de render de React.
    let rafId: number | null = null;
    let pendingProgress: AnalysisProgress | null = null;
    let pendingReport: GameReport | null = null;

    function flushPending() {
      rafId = null;
      if (cancelled) return;
      if (pendingProgress) {
        setProgress(pendingProgress);
        pendingProgress = null;
      }
      if (pendingReport) {
        setReport(pendingReport);
        pendingReport = null;
      }
    }

    function scheduleFlush() {
      if (rafId === null) rafId = requestAnimationFrame(flushPending);
    }

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
            if (cancelled) return;
            pendingProgress = { done, total };
            scheduleFlush();
          },
          onResult: (index, result) => {
            results[index] = result;
            if (cancelled) return;

            // Los resultados llegan en orden estricto (ver EnginePool), así
            // que en este punto siempre están completos 0..index.
            const doneUpTo = index + 1;
            if (doneUpTo < 2) return;

            const partialGame: ParsedGame = {
              ...game,
              positions: game.positions.slice(0, doneUpTo - 1),
            };
            try {
              pendingReport = buildGameReport(
                partialGame,
                results.slice(0, doneUpTo),
              );
              scheduleFlush();
            } catch {
              // No debería pasar, pero un reporte parcial fallido no es fatal.
            }
          },
        });

        if (cancelled) return;
        // No dejar ningún estado a mitad de camino esperando el próximo frame.
        if (rafId !== null) cancelAnimationFrame(rafId);
        flushPending();
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
      if (rafId !== null) cancelAnimationFrame(rafId);
      pool.dispose();
    };
  }, [pgn, profile]);

  function cancel() {
    poolRef.current?.cancel();
    setStatus("cancelled");
  }

  return { status, progress, report, error, cancel };
}
