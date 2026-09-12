"use client";

import type { EngineResult } from "@peon-libre/core";
import { useEffect, useRef, useState } from "react";
import { StockfishWasmEngine } from "@/engine/stockfishWasm";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Status = "loading" | "ready" | "analyzing" | "error";

export default function EngineDebugPage() {
  const engineRef = useRef<StockfishWasmEngine | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [threaded, setThreaded] = useState(false);
  const [fen, setFen] = useState(START_FEN);
  const [depth, setDepth] = useState(18);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const engine = new StockfishWasmEngine();
    engineRef.current = engine;

    engine
      .init()
      .then(() => {
        if (cancelled) return;
        setThreaded(engine.isThreaded);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(String(err));
        setStatus("error");
      });

    return () => {
      cancelled = true;
      engine.dispose();
    };
  }, []);

  async function handleAnalyze() {
    const engine = engineRef.current;
    if (!engine) return;
    setStatus("analyzing");
    setError(null);
    try {
      const res = await engine.analyze(fen, { depth, multiPV: 3 });
      setResult(res);
      setStatus("ready");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  }

  const sortedLines = result
    ? [...result.lines].sort((a, b) => a.multipv - b.multipv)
    : [];

  return (
    <div className="mx-auto max-w-2xl p-8 text-neutral-100">
      <h1 className="mb-2 text-2xl font-semibold">Debug: motor</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Stockfish 18 (build lite), licencia GPLv3 — código fuente:{" "}
        <a
          className="underline"
          href="https://github.com/nmrugg/stockfish.js"
          target="_blank"
          rel="noreferrer"
        >
          github.com/nmrugg/stockfish.js
        </a>
        <br />
        Modo:{" "}
        {status === "loading"
          ? "cargando…"
          : threaded
            ? "multihilo (cross-origin isolated)"
            : "monohilo (sin SharedArrayBuffer/COOP+COEP)"}
      </p>

      <label className="mb-1 block text-sm text-neutral-300" htmlFor="fen">
        FEN
      </label>
      <input
        id="fen"
        className="w-full rounded border border-neutral-700 bg-neutral-900 p-2 font-mono text-sm"
        value={fen}
        onChange={(e) => setFen(e.target.value)}
      />

      <div className="mt-3 flex items-center gap-3">
        <label className="text-sm text-neutral-300" htmlFor="depth">
          Profundidad
        </label>
        <input
          id="depth"
          type="number"
          min={1}
          max={30}
          className="w-20 rounded border border-neutral-700 bg-neutral-900 p-1 text-sm"
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
        />
        <button
          type="button"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={handleAnalyze}
          disabled={status === "loading" || status === "analyzing"}
        >
          {status === "analyzing" ? "Analizando…" : "Analizar"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 space-y-2">
        {sortedLines.map((line) => (
          <div
            key={line.multipv}
            className="rounded border border-neutral-800 p-3 font-mono text-sm"
          >
            <div className="text-neutral-400">
              #{line.multipv} · profundidad {line.depth} ·{" "}
              {line.mateIn !== undefined
                ? `mate en ${line.mateIn}`
                : `${((line.scoreCp ?? 0) / 100).toFixed(2)} peones`}
            </div>
            <div className="mt-1 break-words">{line.pv.join(" ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
