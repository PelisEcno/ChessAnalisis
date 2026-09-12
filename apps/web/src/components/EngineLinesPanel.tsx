"use client";

import type { EngineResult } from "@peon-libre/core";
import { uciPvToSan } from "@/lib/uci";

export interface EngineLinesPanelProps {
  fen: string;
  result: EngineResult | null;
}

function sideToMove(fen: string): "w" | "b" {
  return (fen.split(" ")[1] as "w" | "b" | undefined) ?? "w";
}

function formatScore(
  line: EngineResult["lines"][number],
  stm: "w" | "b",
): string {
  if (line.mateIn !== undefined) {
    const white = stm === "w" ? line.mateIn : -line.mateIn;
    return `${white > 0 ? "+" : "-"}M${Math.abs(white)}`;
  }
  const cp = line.scoreCp ?? 0;
  const white = stm === "w" ? cp : -cp;
  return `${white >= 0 ? "+" : ""}${(white / 100).toFixed(2)}`;
}

/** Las 3 mejores líneas del motor para la posición actual, navegables en SAN. */
export function EngineLinesPanel({ fen, result }: EngineLinesPanelProps) {
  const stm = sideToMove(fen);
  const lines = result
    ? result.lines.slice().sort((a, b) => a.multipv - b.multipv)
    : [];

  return (
    <div className="space-y-1.5 text-xs" aria-live="polite">
      {!result && <p className="text-[var(--muted)]">Calculando…</p>}
      {lines.map((line) => (
        <div key={line.multipv} className="flex gap-2 font-mono">
          <span className="w-14 shrink-0 font-semibold text-[var(--accent)]">
            {formatScore(line, stm)}
          </span>
          <span className="truncate text-[var(--muted)]">
            {uciPvToSan(fen, line.pv).join(" ")}
          </span>
        </div>
      ))}
    </div>
  );
}
