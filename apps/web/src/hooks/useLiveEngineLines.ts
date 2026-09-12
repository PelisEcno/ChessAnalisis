"use client";

import type { EngineResult } from "@peon-libre/core";
import { useEffect, useState } from "react";
import { StockfishWasmEngine } from "@/engine/stockfishWasm";

/**
 * Motor dedicado a analizar en vivo la posición que se esté mirando (sea de
 * la partida principal o de una variante que arma el usuario), separado del
 * EnginePool que analiza toda la partida en lote para el reporte.
 */
export function useLiveEngineLines(
  fen: string | null,
  depth = 16,
): EngineResult | null {
  const [engine, setEngine] = useState<StockfishWasmEngine | null>(null);
  const [result, setResult] = useState<EngineResult | null>(null);

  useEffect(() => {
    const e = new StockfishWasmEngine();
    let disposed = false;
    e.init()
      .then(() => {
        if (!disposed) setEngine(e);
      })
      .catch(() => {
        // si falla la inicialización, el panel se queda vacío en vez de romper la página
      });
    return () => {
      disposed = true;
      e.dispose();
    };
  }, []);

  useEffect(() => {
    if (!engine || !fen) return;
    let cancelled = false;
    // Pequeño debounce: al navegar rápido con las flechas no queremos
    // encolar un análisis por cada posición intermedia.
    const timer = setTimeout(() => {
      engine
        .analyze(fen, { depth, multiPV: 3 })
        .then((res) => {
          if (!cancelled) setResult(res);
        })
        .catch(() => {
          // motor ocupado con la jugada anterior: se resuelve solo en la próxima
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [engine, fen, depth]);

  return result;
}
