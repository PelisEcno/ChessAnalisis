"use client";

import { parsePgn } from "@peon-libre/core";
import { Chess } from "chess.js";
import Link from "next/link";
import { useState } from "react";
import { Board } from "@/components/Board";
import { EngineLinesPanel } from "@/components/EngineLinesPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLiveEngineLines } from "@/hooks/useLiveEngineLines";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface LoadedMove {
  san: string;
  fenAfter: string;
}

export default function FreeAnalysisToolPage() {
  const [fen, setFen] = useState(START_FEN);
  const [fenInput, setFenInput] = useState(START_FEN);
  const [pgnInput, setPgnInput] = useState("");
  const [moves, setMoves] = useState<LoadedMove[]>([]);
  const [activeMoveIndex, setActiveMoveIndex] = useState(-1);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [error, setError] = useState<string | null>(null);

  const liveResult = useLiveEngineLines(fen, 18);

  function handleLoadFen() {
    try {
      new Chess(fenInput.trim()); // solo valida que el FEN sea legal
      setFen(fenInput.trim());
      setMoves([]);
      setActiveMoveIndex(-1);
      setError(null);
    } catch {
      setError("Ese FEN no es válido.");
    }
  }

  function handleLoadPgn() {
    try {
      const game = parsePgn(pgnInput);
      if (game.positions.length === 0) throw new Error("sin jugadas");
      setMoves(
        game.positions.map((p) => ({ san: p.san, fenAfter: p.fenAfter })),
      );
      setFen(game.positions[game.positions.length - 1]!.fenAfter);
      setActiveMoveIndex(game.positions.length - 1);
      setError(null);
    } catch {
      setError("Ese PGN no se pudo parsear.");
    }
  }

  function handlePieceDrop(from: string, to: string): boolean {
    const chess = new Chess(fen);
    try {
      chess.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    setFen(chess.fen());
    setMoves([]);
    setActiveMoveIndex(-1);
    return true;
  }

  function goToMove(index: number) {
    setActiveMoveIndex(index);
    setFen(index === -1 ? START_FEN : moves[index]!.fenAfter);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex items-center justify-between border-b border-[var(--panel-border)] px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Peón Libre
        </Link>
        <ThemeToggle />
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 p-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <Board
            fen={fen}
            orientation={orientation}
            interactive
            onPieceDrop={handlePieceDrop}
          />
          <button
            type="button"
            onClick={() =>
              setOrientation((o) => (o === "white" ? "black" : "white"))
            }
            className="nav-btn mt-3"
          >
            ⇅ voltear
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="fen-input"
              className="mb-1 block text-xs text-[var(--muted)]"
            >
              FEN
            </label>
            <div className="flex gap-2">
              <input
                id="fen-input"
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                className="flex-1 rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2 font-mono text-xs"
              />
              <button type="button" onClick={handleLoadFen} className="nav-btn">
                Cargar
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="pgn-input"
              className="mb-1 block text-xs text-[var(--muted)]"
            >
              PGN
            </label>
            <textarea
              id="pgn-input"
              value={pgnInput}
              onChange={(e) => setPgnInput(e.target.value)}
              rows={4}
              className="w-full rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleLoadPgn}
              className="nav-btn mt-2"
            >
              Cargar PGN
            </button>
          </div>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          {moves.length > 0 && (
            <div className="flex flex-wrap gap-1 rounded border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm">
              {moves.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToMove(i)}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--panel-border)]"
                  style={{
                    backgroundColor:
                      i === activeMoveIndex ? "var(--panel-border)" : undefined,
                  }}
                >
                  {i % 2 === 0 ? `${i / 2 + 1}.` : ""} {m.san}
                </button>
              ))}
            </div>
          )}

          <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-3">
            <h2 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              Motor en vivo
            </h2>
            <EngineLinesPanel fen={fen} result={liveResult} />
          </div>
        </div>
      </div>
    </main>
  );
}
