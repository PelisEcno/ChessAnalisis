import type {
  Engine,
  EngineAnalysisOptions,
  EngineLineResult,
  EngineResult,
} from "@peon-libre/core";

// Builds "lite" de Stockfish 18 (paquete npm "stockfish", GPLv3,
// https://github.com/nmrugg/stockfish.js), copiados a public/engine/ por
// apps/web/scripts/copy-engine-assets.mjs. La build multihilo necesita
// SharedArrayBuffer + crossOriginIsolated (headers COOP/COEP, configurados
// en next.config.ts); si no están disponibles cae a la build monohilo.
const THREADED_ENGINE_PATH = "/engine/stockfish-18-lite.js";
const SINGLE_THREADED_ENGINE_PATH = "/engine/stockfish-18-lite-single.js";

const DEFAULT_DEPTH = 18;

export function supportsThreadedEngine(): boolean {
  return (
    typeof SharedArrayBuffer !== "undefined" &&
    typeof crossOriginIsolated !== "undefined" &&
    crossOriginIsolated
  );
}

function parseInfoLine(line: string): EngineLineResult | null {
  // Solo nos interesan las líneas "info" que traen una variante calculada
  // (multipv + pv); el resto ("info string ...", progreso, etc.) se ignora.
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;

  const depthMatch = /\bdepth (\d+)/.exec(line);
  const multipvMatch = /\bmultipv (\d+)/.exec(line);
  const cpMatch = /\bscore cp (-?\d+)/.exec(line);
  const mateMatch = /\bscore mate (-?\d+)/.exec(line);
  const pvMatch = / pv (.+)$/.exec(line);

  if (!depthMatch || !multipvMatch || !pvMatch) return null;

  return {
    depth: Number(depthMatch[1]),
    multipv: Number(multipvMatch[1]),
    scoreCp: cpMatch ? Number(cpMatch[1]) : undefined,
    mateIn: mateMatch ? Number(mateMatch[1]) : undefined,
    pv: pvMatch[1]!.trim().split(/\s+/),
  };
}

interface PendingAnalysis {
  multiPV: number;
  lines: Map<number, EngineLineResult>;
  resolve: (result: EngineResult) => void;
  reject: (error: unknown) => void;
}

/**
 * Implementación de `Engine` con Stockfish compilado a WASM, corriendo en un
 * Web Worker dedicado. Cada instancia mantiene una sola conversación UCI: no
 * soporta análisis concurrentes (para analizar muchas posiciones en fila,
 * ver engine/pool.ts).
 */
export class StockfishWasmEngine implements Engine {
  private worker: Worker | null = null;
  private threaded = false;
  private pendingUciOk: (() => void) | null = null;
  private pendingReadyOk: (() => void) | null = null;
  private pendingAnalysis: PendingAnalysis | null = null;

  get isThreaded(): boolean {
    return this.threaded;
  }

  async init(): Promise<void> {
    if (this.worker) return;

    this.threaded = supportsThreadedEngine();
    const path = this.threaded
      ? THREADED_ENGINE_PATH
      : SINGLE_THREADED_ENGINE_PATH;

    const worker = new Worker(path);
    worker.onmessage = (event: MessageEvent<string>) => {
      this.handleLine(event.data);
    };
    worker.onerror = (event) => {
      const error = new Error(`El worker de Stockfish falló: ${event.message}`);
      this.pendingAnalysis?.reject(error);
      this.pendingAnalysis = null;
    };
    this.worker = worker;

    await this.waitForUciOk();

    if (this.threaded) {
      const threads = Math.max(1, (navigator.hardwareConcurrency || 2) - 1);
      this.send(`setoption name Threads value ${threads}`);
    }
    this.send("setoption name UCI_ShowWDL value true");

    await this.waitForReadyOk();
  }

  async analyze(
    fen: string,
    opts: EngineAnalysisOptions,
  ): Promise<EngineResult> {
    if (!this.worker) {
      throw new Error("Llamá a init() antes de analyze().");
    }
    if (this.pendingAnalysis) {
      throw new Error(
        "Este motor ya está analizando una posición; esperá a que termine o llamá a stop().",
      );
    }

    this.send(`setoption name MultiPV value ${opts.multiPV}`);
    this.send(`position fen ${fen}`);

    const goCommand = opts.movetime
      ? `go movetime ${opts.movetime}`
      : `go depth ${opts.depth ?? DEFAULT_DEPTH}`;

    return new Promise<EngineResult>((resolve, reject) => {
      this.pendingAnalysis = {
        multiPV: opts.multiPV,
        lines: new Map(),
        resolve,
        reject,
      };
      this.send(goCommand);
    });
  }

  stop(): void {
    if (this.pendingAnalysis) this.send("stop");
  }

  dispose(): void {
    if (this.worker) {
      this.send("quit");
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingAnalysis?.reject(
      new Error("El motor fue destruido (dispose())."),
    );
    this.pendingAnalysis = null;
  }

  private send(command: string): void {
    this.worker?.postMessage(command);
  }

  private waitForUciOk(): Promise<void> {
    return new Promise((resolve) => {
      this.pendingUciOk = resolve;
      this.send("uci");
    });
  }

  private waitForReadyOk(): Promise<void> {
    return new Promise((resolve) => {
      this.pendingReadyOk = resolve;
      this.send("isready");
    });
  }

  private handleLine(line: string): void {
    if (line === "uciok") {
      this.pendingUciOk?.();
      this.pendingUciOk = null;
      return;
    }

    if (line === "readyok") {
      this.pendingReadyOk?.();
      this.pendingReadyOk = null;
      return;
    }

    if (line.startsWith("bestmove")) {
      const analysis = this.pendingAnalysis;
      this.pendingAnalysis = null;
      if (analysis) {
        analysis.resolve({ lines: [...analysis.lines.values()] });
      }
      return;
    }

    if (this.pendingAnalysis) {
      const parsed = parseInfoLine(line);
      if (parsed) this.pendingAnalysis.lines.set(parsed.multipv, parsed);
    }
  }
}
