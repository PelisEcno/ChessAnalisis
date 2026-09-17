"use client";

import { evalToWinPercent } from "@peon-libre/core";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccuracyCard } from "@/components/AccuracyCard";
import { Board } from "@/components/Board";
import { BrilliantMoments } from "@/components/BrilliantMoments";
import { EngineLinesPanel } from "@/components/EngineLinesPanel";
import { EvalBar } from "@/components/EvalBar";
import { EvalGraph } from "@/components/EvalGraph";
import { MoveList } from "@/components/MoveList";
import { PlayerBar } from "@/components/PlayerBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useGameAnalysis } from "@/hooks/useGameAnalysis";
import { useGameNavigation } from "@/hooks/useGameNavigation";
import { useLiveEngineLines } from "@/hooks/useLiveEngineLines";
import {
  bestLineOf,
  lineToWhiteEval,
  sideToMoveFromFen,
} from "@/lib/engineEval";
import { describeMove } from "@/lib/moveLabels";
import { readPendingGame, type PendingGame } from "@/lib/pendingGame";

type MobileTab = "moves" | "analysis";

export default function AnalysisPage() {
  const [pending, setPending] = useState<PendingGame | null>(null);
  const [loadedPending, setLoadedPending] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("moves");

  useEffect(() => {
    setPending(readPendingGame());
    setLoadedPending(true);
  }, []);

  const { status, progress, report, error } = useGameAnalysis(
    pending?.pgn ?? null,
  );

  const nav = useGameNavigation(report);
  const liveResult = useLiveEngineLines(nav.currentFen);

  const currentAnnotated = useMemo(() => {
    if (!report) return undefined;
    if (nav.cursor.kind !== "main" || nav.cursor.index === 0) return undefined;
    return report.moves[nav.cursor.index - 1];
  }, [report, nav.cursor]);

  const currentWinPercent = useMemo(() => {
    if (report && nav.cursor.kind === "main") {
      if (nav.cursor.index === 0) return 50;
      return report.evalGraph[nav.cursor.index - 1] ?? 50;
    }
    if (liveResult) {
      const best = bestLineOf(liveResult);
      if (best) {
        return evalToWinPercent(
          lineToWhiteEval(best, sideToMoveFromFen(nav.currentFen)),
        );
      }
    }
    return 50;
  }, [report, nav.cursor, nav.currentFen, liveResult]);

  const graphPoints = useMemo(() => {
    if (!report) return [];
    return [
      { ply: 0, winPercent: 50, san: "inicio" },
      ...report.moves.map((m, i) => ({
        ply: i + 1,
        winPercent: report.evalGraph[i] ?? 50,
        san: m.san,
      })),
    ];
  }, [report]);

  const criticalPlies = useMemo(
    () => report?.criticalMoments.map((m) => m.ply) ?? [],
    [report],
  );

  const moveBadge = useMemo(() => {
    if (!currentAnnotated || !nav.lastMove) return null;
    return { square: nav.lastMove.to, label: currentAnnotated.label };
  }, [currentAnnotated, nav.lastMove]);

  const sideToMove = sideToMoveFromFen(nav.currentFen);

  // Navegación por teclado: flechas, inicio/fin, F para voltear el tablero.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          nav.goBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          nav.goForward();
          break;
        case "Home":
          e.preventDefault();
          nav.goStart();
          break;
        case "End":
          e.preventDefault();
          nav.goEnd();
          break;
        case "f":
        case "F":
          nav.flip();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.goBack, nav.goForward, nav.goStart, nav.goEnd, nav.flip]);

  if (loadedPending && !pending) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-[var(--muted)]">
          No hay ninguna partida para analizar todavía.
        </p>
        <Link href="/" className="text-[var(--accent)] hover:underline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  const whiteName = report?.headers.white ?? "Blancas";
  const blackName = report?.headers.black ?? "Negras";
  const whiteElo = report?.headers.whiteElo;
  const blackElo = report?.headers.blackElo;
  const whiteAccuracy = report?.players.w.accuracy;
  const blackAccuracy = report?.players.b.accuracy;

  const topPlayer =
    nav.orientation === "white"
      ? {
          name: blackName,
          color: "black" as const,
          elo: blackElo,
          accuracy: blackAccuracy,
          toMove: sideToMove === "b",
        }
      : {
          name: whiteName,
          color: "white" as const,
          elo: whiteElo,
          accuracy: whiteAccuracy,
          toMove: sideToMove === "w",
        };
  const bottomPlayer =
    nav.orientation === "white"
      ? {
          name: whiteName,
          color: "white" as const,
          elo: whiteElo,
          accuracy: whiteAccuracy,
          toMove: sideToMove === "w",
        }
      : {
          name: blackName,
          color: "black" as const,
          elo: blackElo,
          accuracy: blackAccuracy,
          toMove: sideToMove === "b",
        };

  const rightPanel = (
    <div className="space-y-4">
      {report && (
        <BrilliantMoments moves={report.moves} onSelect={nav.goToMain} />
      )}
      {report && (
        <div className="card p-3">
          <EvalGraph
            points={graphPoints}
            criticalPlies={criticalPlies}
            currentPly={nav.cursor.kind === "main" ? nav.cursor.index : 0}
            onSelectPly={nav.goToMain}
          />
        </div>
      )}
      {report && (
        <AccuracyCard
          report={report}
          whiteName={whiteName}
          blackName={blackName}
        />
      )}
      <div className="card p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
          Líneas del motor
        </h2>
        <EngineLinesPanel fen={nav.currentFen} result={liveResult} />
      </div>
      <div className="card p-3 text-sm">
        {currentAnnotated
          ? describeMove(currentAnnotated)
          : nav.cursor.kind === "variation"
            ? "Estás explorando una variante propia."
            : "Posición inicial."}
      </div>
    </div>
  );

  const moveListPanel = report ? (
    <MoveList
      moves={report.moves}
      variation={nav.variation}
      cursor={nav.cursor}
      onGoToMain={nav.goToMain}
      onGoToVariation={nav.goToVariation}
      onClearVariation={nav.clearVariation}
    />
  ) : null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header
        className="flex items-center justify-between bg-[var(--panel)] px-4 py-3"
        style={{ boxShadow: "var(--elevation-1)" }}
      >
        <Link href="/" className="text-lg font-semibold">
          Peón Libre
        </Link>
        <ThemeToggle />
      </header>

      {error && <p className="p-4 text-sm text-[var(--danger)]">{error}</p>}

      {status === "analyzing" && (
        <div className="px-4 pt-3">
          <div className="card h-2 w-full overflow-hidden !rounded-full p-0">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-300 ease-out"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Analizando y reproduciendo la partida… {progress.done}/
            {progress.total}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,480px)_260px_320px]">
        {/* Columna 1: tablero */}
        <div>
          <PlayerBar
            name={topPlayer.name}
            color={topPlayer.color}
            elo={topPlayer.elo}
            accuracy={topPlayer.accuracy}
            toMove={topPlayer.toMove}
          />
          <div className="my-1.5 flex gap-2">
            <EvalBar
              winPercent={currentWinPercent}
              flipped={nav.orientation === "black"}
            />
            <div className="card flex-1 overflow-hidden !rounded-2xl p-1.5">
              <Board
                fen={nav.currentFen}
                orientation={nav.orientation}
                interactive
                lastMove={nav.lastMove}
                moveBadge={moveBadge}
                onPieceDrop={(from, to) => nav.tryPlayMove(from, to)}
              />
            </div>
          </div>
          <PlayerBar
            name={bottomPlayer.name}
            color={bottomPlayer.color}
            elo={bottomPlayer.elo}
            accuracy={bottomPlayer.accuracy}
            toMove={bottomPlayer.toMove}
          />
          <div className="mt-3 flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={nav.goStart}
              className="nav-btn"
              aria-label="Inicio"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={nav.goBack}
              disabled={!nav.canGoBack}
              className="nav-btn"
              aria-label="Jugada anterior"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={nav.goForward}
              disabled={!nav.canGoForward}
              className="nav-btn"
              aria-label="Jugada siguiente"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={nav.goEnd}
              className="nav-btn"
              aria-label="Final"
            >
              ⏭
            </button>
            <button
              type="button"
              onClick={nav.flip}
              className="nav-btn nav-btn--accent"
              aria-label="Voltear tablero"
            >
              ⇅
            </button>
          </div>

          {/* En mobile, el resto del panel vive acá abajo con tabs. */}
          <div className="mt-4 lg:hidden">
            <div className="flex gap-2 border-b border-[var(--panel-border)]">
              <button
                type="button"
                onClick={() => setMobileTab("moves")}
                className={`px-3 py-2 text-sm ${mobileTab === "moves" ? "border-b-2 border-[var(--accent)] font-medium" : "text-[var(--muted)]"}`}
              >
                Jugadas
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("analysis")}
                className={`px-3 py-2 text-sm ${mobileTab === "analysis" ? "border-b-2 border-[var(--accent)] font-medium" : "text-[var(--muted)]"}`}
              >
                Análisis
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pt-3">
              {mobileTab === "moves" ? moveListPanel : rightPanel}
            </div>
          </div>
        </div>

        {/* Columna 2: lista de jugadas (solo desktop) */}
        <div className="card hidden max-h-[80vh] overflow-y-auto lg:block">
          {moveListPanel}
        </div>

        {/* Columna 3: panel derecho (solo desktop) */}
        <div className="hidden lg:block">{rightPanel}</div>
      </div>
    </main>
  );
}
