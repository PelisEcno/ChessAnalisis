"use client";

import { useMemo, useRef, useState } from "react";

export interface EvalGraphPoint {
  ply: number;
  winPercent: number;
  san: string;
}

export interface EvalGraphProps {
  points: EvalGraphPoint[];
  criticalPlies?: number[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

const WIDTH = 600;
const HEIGHT = 120;

function xFor(ply: number, total: number): number {
  if (total <= 0) return 0;
  return (ply / total) * WIDTH;
}

function yFor(winPercent: number): number {
  return HEIGHT - (winPercent / 100) * HEIGHT;
}

/**
 * Gráfico de evaluación de toda la partida: área blanca/negra dividida en el
 * 50% (convención estándar de ajedrez, no una paleta categórica genérica).
 * Con crosshair + tooltip al pasar el mouse, y click para navegar a esa
 * jugada — ver skill de dataviz, sección de interacción.
 */
export function EvalGraph({
  points,
  criticalPlies = [],
  currentPly,
  onSelectPly,
}: EvalGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverPly, setHoverPly] = useState<number | null>(null);

  const total = points.length - 1;

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const top = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xFor(i, total)} ${yFor(p.winPercent)}`,
      )
      .join(" ");
    return `${top} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;
  }, [points, total]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xFor(i, total)} ${yFor(p.winPercent)}`,
      )
      .join(" ");
  }, [points, total]);

  function plyFromClientX(clientX: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * total);
  }

  const hovered = hoverPly !== null ? points[hoverPly] : undefined;
  const shown = hovered ?? points[currentPly];

  return (
    <div className="w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full cursor-pointer"
        role="img"
        aria-label="Gráfico de evaluación de la partida: porcentaje de victoria de blancas jugada a jugada"
        onMouseMove={(e) => setHoverPly(plyFromClientX(e.clientX))}
        onMouseLeave={() => setHoverPly(null)}
        onClick={(e) => onSelectPly(plyFromClientX(e.clientX))}
      >
        {/* franja negra de fondo; el área blanca se dibuja encima */}
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="var(--eval-black)"
        />
        <path d={areaPath} fill="var(--eval-white)" />
        <line
          x1={0}
          y1={HEIGHT / 2}
          x2={WIDTH}
          y2={HEIGHT / 2}
          stroke="var(--panel-border)"
          strokeWidth={1}
        />
        <path
          d={linePath}
          fill="none"
          stroke="var(--panel-border)"
          strokeWidth={1}
        />

        {criticalPlies.map((ply) => {
          const p = points[ply];
          if (!p) return null;
          return (
            <circle
              key={ply}
              cx={xFor(ply, total)}
              cy={yFor(p.winPercent)}
              r={3}
              fill="var(--label-blunder)"
              stroke="var(--background)"
              strokeWidth={1}
            />
          );
        })}

        {/* cursor de la jugada actual */}
        <line
          x1={xFor(currentPly, total)}
          y1={0}
          x2={xFor(currentPly, total)}
          y2={HEIGHT}
          stroke="var(--accent)"
          strokeWidth={2}
        />

        {hoverPly !== null && (
          <line
            x1={xFor(hoverPly, total)}
            y1={0}
            x2={xFor(hoverPly, total)}
            y2={HEIGHT}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>
      <div className="mt-1 h-4 text-center text-xs text-[var(--muted)]">
        {shown ? `${shown.san} · blancas ${shown.winPercent.toFixed(0)}%` : ""}
      </div>
    </div>
  );
}
