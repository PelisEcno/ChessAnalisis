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
}

/**
 * Cola que analiza una partida completa (lista de FEN, uno por ply) en
 * orden: Stockfish solo puede analizar una posición a la vez. Mantiene un
 * único Web Worker vivo entre llamadas, cachea por FEN+profundidad en
 * IndexedDB, y reinicia el motor si el worker muere a mitad de análisis.
 */
export class EnginePool {
  private engine: Engine | null = null;
  private cancelled = false;

  private async getEngine(): Promise<Engine> {
    if (!this.engine) {
      const engine = new StockfishWasmEngine();
      await engine.init();
      this.engine = engine;
    }
    return this.engine;
  }

  private async restartEngine(): Promise<Engine> {
    this.engine?.dispose();
    this.engine = null;
    return this.getEngine();
  }

  private async analyzeOneWithRetry(
    fen: string,
    opts: { depth: number; multiPV: number },
  ): Promise<EngineResult> {
    const engine = await this.getEngine();
    try {
      return await engine.analyze(fen, opts);
    } catch {
      // El worker puede haber muerto (crash, memoria, etc.): lo reiniciamos
      // una vez y reintentamos esta misma posición antes de rendirnos.
      const restarted = await this.restartEngine();
      return restarted.analyze(fen, opts);
    }
  }

  /** Pide que el análisis en curso pare lo antes posible. */
  cancel(): void {
    this.cancelled = true;
    this.engine?.stop();
  }

  /** Libera el worker. Después de esto hay que crear un EnginePool nuevo. */
  dispose(): void {
    this.engine?.dispose();
    this.engine = null;
  }

  async analyzeGame(
    fens: string[],
    options: AnalyzeGameOptions = {},
  ): Promise<EngineResult[]> {
    const depth = PROFILE_DEPTH[options.profile ?? "normal"];
    const multiPV = options.multiPV ?? DEFAULT_MULTIPV;

    this.cancelled = false;
    const results: EngineResult[] = [];

    for (let i = 0; i < fens.length; i++) {
      if (this.cancelled) break;
      const fen = fens[i]!;

      const cached = await getCachedAnalysis(fen, depth);
      const result =
        cached ?? (await this.analyzeOneWithRetry(fen, { depth, multiPV }));

      if (this.cancelled) break;

      if (!cached) await setCachedAnalysis(fen, depth, result);
      results.push(result);
      options.onProgress?.(i + 1, fens.length);
    }

    return results;
  }
}
