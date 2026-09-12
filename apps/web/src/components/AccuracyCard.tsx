import type { GameReport, MoveLabel } from "@peon-libre/core";
import { MOVE_LABEL_META } from "@/lib/moveLabels";

export interface AccuracyCardProps {
  report: GameReport;
  whiteName: string;
  blackName: string;
}

const LABELS_TO_SHOW: MoveLabel[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
  "missed_win",
];

export function AccuracyCard({
  report,
  whiteName,
  blackName,
}: AccuracyCardProps) {
  return (
    <div className="rounded border border-[var(--panel-border)] bg-[var(--panel)] p-3">
      <div className="flex justify-between">
        <div>
          <div className="truncate text-xs text-[var(--muted)]">
            {whiteName}
          </div>
          <div className="text-2xl font-semibold">
            {report.players.w.accuracy.toFixed(1)}%
          </div>
        </div>
        <div className="text-right">
          <div className="truncate text-xs text-[var(--muted)]">
            {blackName}
          </div>
          <div className="text-2xl font-semibold">
            {report.players.b.accuracy.toFixed(1)}%
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-0.5 text-xs">
        {LABELS_TO_SHOW.map((label) => {
          const w = report.players.w.labelCounts[label];
          const b = report.players.b.labelCounts[label];
          if (w === 0 && b === 0) return null;
          const meta = MOVE_LABEL_META[label];
          return (
            <li key={label} className="flex items-center justify-between gap-2">
              <span style={{ color: meta.color }}>
                {meta.glyph} {meta.text}
              </span>
              <span className="font-mono text-[var(--muted)]">
                {w} – {b}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
