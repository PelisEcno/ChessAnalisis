import { NativeStockfishEngine } from "./nativeStockfish.js";

// Se cachea a nivel de proceso: la versión del binario no cambia mientras
// el worker esté corriendo (queda fija en la imagen Docker).
let cached: string | null = null;

export async function getEngineVersion(): Promise<string> {
  if (cached) return cached;
  const engine = new NativeStockfishEngine();
  await engine.init();
  cached = engine.engineId;
  engine.dispose();
  return cached;
}
