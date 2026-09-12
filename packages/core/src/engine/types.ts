/**
 * Interfaz que debe implementar cualquier backend de motor UCI (Stockfish
 * WASM en el navegador ahora, Stockfish nativo en el servidor más adelante).
 * Los valores de `scoreCp`/`mateIn` son los crudos del protocolo UCI, en
 * perspectiva de quien mueve en el FEN analizado — no en perspectiva de
 * blancas como el tipo `Eval` del resto del paquete; la conversión es
 * responsabilidad de quien arma un `MoveContext` a partir de un `EngineResult`.
 */
export interface Engine {
  init(): Promise<void>;
  analyze(fen: string, opts: EngineAnalysisOptions): Promise<EngineResult>;
  stop(): void;
  dispose(): void;
}

export interface EngineAnalysisOptions {
  depth?: number;
  movetime?: number;
  multiPV: number;
}

export interface EngineLineResult {
  multipv: number;
  scoreCp?: number | undefined;
  mateIn?: number | undefined;
  pv: string[];
  depth: number;
}

export interface EngineResult {
  lines: EngineLineResult[];
}
