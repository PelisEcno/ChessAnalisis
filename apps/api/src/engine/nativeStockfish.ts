import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import {
  parseUciInfoLine,
  type Engine,
  type EngineAnalysisOptions,
  type EngineLineResult,
  type EngineResult,
} from "@peon-libre/core";

const DEFAULT_DEPTH = 18;

interface PendingAnalysis {
  lines: Map<number, EngineLineResult>;
  resolve: (result: EngineResult) => void;
  reject: (error: unknown) => void;
}

interface Waiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Implementación de Engine con el binario nativo de Stockfish (instalado en
 * la imagen Docker, ver Dockerfile), hablado por stdin/stdout en UCI. Mismo
 * protocolo que la build WASM del navegador (apps/web/src/engine), pero acá
 * corre nativo: mucho más rápido, se usa en el worker de análisis (fase 5).
 */
export class NativeStockfishEngine implements Engine {
  private process: ChildProcessWithoutNullStreams | null = null;
  private pendingUciOk: Waiter | null = null;
  private pendingReadyOk: Waiter | null = null;
  private pendingAnalysis: PendingAnalysis | null = null;
  private _engineId = "stockfish";

  constructor(private readonly binaryPath: string = "stockfish") {}

  /** "Stockfish 16.1" o similar, tal como lo reporta el propio binario. */
  get engineId(): string {
    return this._engineId;
  }

  async init(): Promise<void> {
    if (this.process) return;

    const proc = spawn(this.binaryPath, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = proc;

    createInterface({ input: proc.stdout }).on("line", (line) => {
      this.handleLine(line);
    });

    proc.on("error", (error) => {
      this.failEverything(error);
    });
    proc.on("exit", (code) => {
      this.failEverything(
        new Error(`Stockfish terminó inesperadamente (código ${code}).`),
      );
      this.process = null;
    });

    await this.waitForUciOk();
    // El paralelismo se maneja a nivel de cuántos jobs concurrentes corre
    // BullMQ, no dentro de cada motor individual.
    this.send("setoption name Threads value 1");
    await this.waitForReadyOk();
  }

  async analyze(
    fen: string,
    opts: EngineAnalysisOptions,
  ): Promise<EngineResult> {
    if (!this.process) {
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
      this.pendingAnalysis = { lines: new Map(), resolve, reject };
      this.send(goCommand);
    });
  }

  stop(): void {
    if (this.pendingAnalysis) this.send("stop");
  }

  dispose(): void {
    if (this.process) {
      this.send("quit");
      this.process.kill();
      this.process = null;
    }
    this.failEverything(new Error("El motor fue destruido (dispose())."));
  }

  /** Rechaza cualquier promesa pendiente (init o analyze): usado ante error o salida del proceso. */
  private failEverything(error: unknown): void {
    this.pendingUciOk?.reject(error);
    this.pendingUciOk = null;
    this.pendingReadyOk?.reject(error);
    this.pendingReadyOk = null;
    this.pendingAnalysis?.reject(error);
    this.pendingAnalysis = null;
  }

  private send(command: string): void {
    this.process?.stdin.write(command + "\n");
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
    if (line.startsWith("id name ")) {
      this._engineId = line.slice("id name ".length).trim();
      return;
    }

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
