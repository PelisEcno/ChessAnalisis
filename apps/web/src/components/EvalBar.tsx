export interface EvalBarProps {
  /** Win% (perspectiva de blancas), 0-100. */
  winPercent: number;
  /** Texto corto a mostrar, p.ej. "+1.2" o "M3". */
  label?: string;
  /** Si el tablero está volteado, blancas quedan arriba en vez de abajo. */
  flipped?: boolean;
}

/**
 * Barra de evaluación vertical animada: blanco ocupa `winPercent`% de la
 * altura, con una transición suave cuando cambia (navegar entre jugadas).
 */
export function EvalBar({ winPercent, label, flipped = false }: EvalBarProps) {
  const whiteHeight = Math.min(100, Math.max(0, winPercent));

  return (
    <div
      className="relative h-full w-6 shrink-0 overflow-hidden rounded"
      style={{ backgroundColor: "var(--eval-black)" }}
      role="meter"
      aria-valuenow={Math.round(winPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Barra de evaluación, porcentaje de victoria de blancas"
    >
      <div
        className="absolute left-0 w-full transition-[height] duration-500 ease-out"
        style={{
          height: `${whiteHeight}%`,
          backgroundColor: "var(--eval-white)",
          ...(flipped ? { top: 0 } : { bottom: 0 }),
        }}
      />
      {label && (
        <div
          className={`absolute inset-x-0 ${flipped ? "top-1" : "bottom-1"} text-center text-[10px] font-medium text-neutral-500`}
        >
          {label}
        </div>
      )}
    </div>
  );
}
