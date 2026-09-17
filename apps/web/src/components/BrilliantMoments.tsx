import type { AnnotatedMove } from "@peon-libre/core";

export interface BrilliantMomentsProps {
  moves: AnnotatedMove[];
  onSelect: (ply: number) => void;
}

/**
 * Destaca las jugadas brillantes de la partida en su propia tarjeta, en vez
 * de dejarlas perdidas en el conteo de AccuracyCard: es el tipo de jugada
 * más vistoso y vale la pena poder saltar directo a ella.
 */
export function BrilliantMoments({ moves, onSelect }: BrilliantMomentsProps) {
  const brilliant = moves.filter((m) => m.label === "brilliant");
  if (brilliant.length === 0) return null;

  return (
    <div
      className="card p-3"
      style={{
        borderColor: "var(--label-brilliant)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--label-brilliant) 14%, var(--panel)), var(--panel))",
      }}
    >
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--label-brilliant)]">
        ✨ {brilliant.length === 1 ? "Jugada brillante" : "Jugadas brillantes"}
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {brilliant.map((m) => (
          <li key={m.ply}>
            <button
              type="button"
              onClick={() => onSelect(m.ply)}
              className="rounded-full px-2.5 py-1 text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: "var(--label-brilliant)" }}
            >
              {m.moveNumber}
              {m.color === "b" ? "…" : "."} {m.san}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
