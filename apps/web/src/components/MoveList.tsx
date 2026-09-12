"use client";

import type { AnnotatedMove, MoveLabel } from "@peon-libre/core";
import { Fragment } from "react";
import type { Cursor, Variation } from "@/hooks/useGameNavigation";
import { MOVE_LABEL_META } from "@/lib/moveLabels";

export interface MoveListProps {
  moves: AnnotatedMove[];
  variation: Variation | null;
  cursor: Cursor;
  onGoToMain: (index: number) => void;
  onGoToVariation: (index: number) => void;
  onClearVariation: () => void;
}

function MoveButton({
  label,
  san,
  active,
  onClick,
}: {
  label: MoveLabel;
  san: string;
  active: boolean;
  onClick: () => void;
}) {
  const meta = MOVE_LABEL_META[label];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      aria-label={`${san}, ${meta.text}`}
      className="rounded px-1.5 py-0.5 text-sm font-medium hover:bg-[var(--panel-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
      style={{
        color: meta.color,
        backgroundColor: active ? "var(--panel-border)" : undefined,
      }}
      title={meta.text}
    >
      {san}
      {meta.glyph && <span className="ml-0.5 text-xs">{meta.glyph}</span>}
    </button>
  );
}

function VariationRow({
  variation,
  cursor,
  onGoToVariation,
  onClearVariation,
}: {
  variation: Variation;
  cursor: Cursor;
  onGoToVariation: (index: number) => void;
  onClearVariation: () => void;
}) {
  return (
    <li className="w-full basis-full">
      <ol className="ml-4 flex flex-wrap items-center gap-x-1 gap-y-1 border-l-2 border-[var(--panel-border)] py-1 pl-2 italic">
        {variation.moves.map((move, i) => (
          <li key={i} className="flex items-center gap-1">
            {i === 0 && move.color === "b" && (
              <span className="text-xs text-[var(--muted)]">…</span>
            )}
            <button
              type="button"
              onClick={() => onGoToVariation(i + 1)}
              aria-current={
                cursor.kind === "variation" && cursor.index === i + 1
                  ? "true"
                  : undefined
              }
              className="rounded px-1.5 py-0.5 text-sm font-medium text-[var(--muted)] hover:bg-[var(--panel-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              style={{
                backgroundColor:
                  cursor.kind === "variation" && cursor.index === i + 1
                    ? "var(--panel-border)"
                    : undefined,
              }}
            >
              {move.san}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onClearVariation}
            aria-label="Descartar esta variante y volver a la partida"
            className="ml-1 text-xs text-[var(--muted)] hover:text-[var(--danger)]"
          >
            ✕
          </button>
        </li>
      </ol>
    </li>
  );
}

/**
 * Lista de jugadas de la línea principal, con una variante propia (creada
 * arrastrando piezas en el tablero) anidada justo debajo del punto donde se
 * ramifica. Ver useGameNavigation para por qué es una sola variante y no un
 * árbol completo.
 */
export function MoveList({
  moves,
  variation,
  cursor,
  onGoToMain,
  onGoToVariation,
  onClearVariation,
}: MoveListProps) {
  return (
    <ol
      aria-label="Jugadas de la partida"
      className="flex flex-wrap items-start gap-x-1 gap-y-2 p-2 text-sm"
    >
      {variation && variation.branchAtIndex === 0 && (
        <VariationRow
          variation={variation}
          cursor={cursor}
          onGoToVariation={onGoToVariation}
          onClearVariation={onClearVariation}
        />
      )}
      {moves.map((move, i) => (
        <Fragment key={move.ply}>
          <li className="flex items-center gap-1">
            {move.color === "w" && (
              <span className="text-xs text-[var(--muted)]">
                {move.moveNumber}.
              </span>
            )}
            <MoveButton
              label={move.label}
              san={move.san}
              active={cursor.kind === "main" && cursor.index === i + 1}
              onClick={() => onGoToMain(i + 1)}
            />
          </li>
          {variation && variation.branchAtIndex === i + 1 && (
            <VariationRow
              variation={variation}
              cursor={cursor}
              onGoToVariation={onGoToVariation}
              onClearVariation={onClearVariation}
            />
          )}
        </Fragment>
      ))}
    </ol>
  );
}
