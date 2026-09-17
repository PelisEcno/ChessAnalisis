import {
  parseUciInfoLine,
  type Engine,
  type EngineAnalysisOptions,
  type EngineLineResult,
  type EngineResult,
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

interface PendingAnalysis {
  multiPV: number;
  lines: Map<number, EngineLineResult>;
  resolve: (result: EngineResult) => void;
  reject: (error: unknown) => void;
}

interface Waiter {
  resolve: () => void;
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
  private pendingUciOk: Waiter | null = null;
  private pendingReadyOk: Waiter | null = null;
  private pendingAnalysis: PendingAnalysis | null = null;

  /**
   * Threads a pedirle al motor si la build multihilo está disponible. Por
   * default usa casi todos los cores (para el motor "en vivo" de una sola
   * posición); EnginePool pasa un número menor a propósito, para poder
   * correr varias instancias en paralelo sin sobre-suscribir los cores.
   */
  constructor(private readonly threadsOverride?: number) {}

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
      this.failEverything(
        new Error(`El worker de Stockfish falló: ${event.message}`),
      );
    };
    this.worker = worker;

    await this.waitForUciOk();

    if (this.threaded) {
      const threads =
        this.threadsOverride ??
        Math.max(1, (navigator.hardwareConcurrency || 2) - 1);
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
    this.failEverything(new Error("El motor fue destruido (dispose())."));
  }

  /** Rechaza cualquier promesa pendiente (init o analyze): usado ante error del worker. */
  private failEverything(error: unknown): void {
    this.pendingUciOk?.reject(error);
    this.pendingUciOk = null;
    this.pendingReadyOk?.reject(error);
    this.pendingReadyOk = null;
    this.pendingAnalysis?.reject(error);
    this.pendingAnalysis = null;
  }

  private send(command: string): void {
    this.worker?.postMessage(command);
  }

  private waitForUciOk(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingUciOk = { resolve, reject };
      this.send("uci");
    });
  }

  private waitForReadyOk(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pendingReadyOk = { resolve, reject };
      this.send("isready");
    });
  }

  private handleLine(line: string): void {
    if (line === "uciok") {
      this.pendingUciOk?.resolve();
      this.pendingUciOk = null;
      return;
    }

    if (line === "readyok") {
      this.pendingReadyOk?.resolve();
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
      const parsed = parseUciInfoLine(line);
      if (parsed) this.pendingAnalysis.lines.set(parsed.multipv, parsed);
    }
  }
}
