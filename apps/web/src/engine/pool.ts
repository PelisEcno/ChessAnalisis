import type { Engine, EngineResult } from "@peon-libre/core";
import { getCachedAnalysis, setCachedAnalysis } from "./cache";
import { StockfishWasmEngine } from "./stockfishWasm";

export type EngineProfile = "fast" | "normal" | "deep";

const PROFILE_DEPTH: Record<EngineProfile, number> = {
  fast: 14,
  normal: 18,
  deep: 22,
};

const DEFAULT_MULTIPV = 3;

export interface AnalyzeGameOptions {
  profile?: EngineProfile;
  multiPV?: number;
  onProgress?: (ply: number, total: number) => void;
  /**
   * Se llama en orden estricto (0, 1, 2, ...) apenas se completa cada
   * posición (venga de caché o del motor), aunque el cómputo interno haya
   * terminado en otro orden por correr en paralelo. Permite mostrar
   * resultados en streaming en vez de esperar a que termine toda la partida.
   */
  onResult?: (index: number, result: EngineResult) => void;
}

/**
 * Cuántas instancias del motor correr en simultáneo, y cuántos threads le
 * toca a cada una. Un solo motor con muchos threads tiene rendimientos
 * decrecientes pasados los 3-4 threads (overhead de sincronización de la
 * búsqueda), así que para analizar muchas posiciones distintas rinde más
 * repartir los cores entre varias búsquedas en paralelo que apilarlos todos
 * en una sola. Con pocos cores (mobile, VMs chicas) no vale la pena partir:
 * una sola instancia con todo lo disponible es lo más simple y seguro.
 */
function poolSize(cores: number): number {
  if (cores >= 6) return 2;
  return 1;
}

function threadsPerEngine(cores: number, workers: number): number {
  return Math.max(1, Math.floor((cores - 1) / workers));
}

/**
 * Analiza una partida completa (lista de FEN, uno por ply) repartiendo las
 * posiciones entre varias instancias de Stockfish que corren en paralelo,
 * cada una en su propio Web Worker. Cachea por FEN+profundidad en
 * IndexedDB, y reinicia cualquier instancia que muera a mitad de análisis.
 */
export class EnginePool {
  private engines: Engine[] = [];
  private cancelled = false;

  private async createEngine(threads: number): Promise<StockfishWasmEngine> {
    const engine = new StockfishWasmEngine(threads);
    await engine.init();
    return engine;
  }

  /** Pide que el análisis en curso pare lo antes posible. */
  cancel(): void {
    this.cancelled = true;
    for (const engine of this.engines) engine.stop();
  }

  /** Libera todos los workers. Después de esto hay que crear un EnginePool nuevo. */
  dispose(): void {
    for (const engine of this.engines) engine.dispose();
    this.engines = [];
  }

  async analyzeGame(
    fens: string[],
    options: AnalyzeGameOptions = {},
  ): Promise<EngineResult[]> {
    const depth = PROFILE_DEPTH[options.profile ?? "normal"];
    const multiPV = options.multiPV ?? DEFAULT_MULTIPV;

    this.cancelled = false;
    const results: (EngineResult | undefined)[] = new Array(fens.length);
    let nextToAssign = 0;
    let nextToEmit = 0;

    // Emite en orden estricto (0, 1, 2, ...) aunque el cómputo interno haya
    // terminado en otro orden por correr en paralelo. Quién consume esto
    // (useGameAnalysis) es responsable de no volcar cada emisión directo a
    // React: si muchas quedan listas casi juntas (por ejemplo, partida ya
    // cacheada entera) hay que agruparlas antes de tocar el estado.
    const emitReady = () => {
      while (nextToEmit < fens.length && results[nextToEmit] !== undefined) {
        options.onResult?.(nextToEmit, results[nextToEmit]!);
        nextToEmit++;
        options.onProgress?.(nextToEmit, fens.length);
      }
    };

    const cores =
      typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
    const workerCount = Math.min(poolSize(cores), fens.length || 1);
    const threads = threadsPerEngine(cores, workerCount);

    const runWorker = async (slot: number): Promise<void> => {
      let engine = await this.createEngine(threads);
      this.engines[slot] = engine;

      while (!this.cancelled) {
        const i = nextToAssign++;
        if (i >= fens.length) return;
        const fen = fens[i]!;

        const cached = await getCachedAnalysis(fen, depth);
        let result: EngineResult;
        if (cached) {
          result = cached;
        } else {
          try {
            result = await engine.analyze(fen, { depth, multiPV });
          } catch {
            // El worker puede haber muerto (crash, memoria, etc.): lo
            // reiniciamos una vez y reintentamos esta misma posición.
            engine.dispose();
            engine = await this.createEngine(threads);
            this.engines[slot] = engine;
            result = await engine.analyze(fen, { depth, multiPV });
          }
          if (this.cancelled) return;
          await setCachedAnalysis(fen, depth, result);
        }

        if (this.cancelled) return;
        results[i] = result;
        emitReady();
      }
    };

    await Promise.all(
      Array.from({ length: workerCount }, (_, slot) => runWorker(slot)),
    );

    return results as EngineResult[];
  }
}
