import type { EngineResult } from "@peon-libre/core";

// Cachea resultados de análisis por FEN+profundidad: las aperturas y los
// finales teóricos se repiten muchísimo entre partidas, así no hace falta
// volver a analizarlos cada vez.
const DB_NAME = "peon-libre-engine-cache";
const STORE_NAME = "analysis";
const DB_VERSION = 1;

function cacheKey(fen: string, depth: number): string {
  return `${fen}::${depth}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error as unknown);
  });
}

/**
 * Si IndexedDB no está disponible (SSR, modo privado estricto de Safari,
 * etc.) simplemente no cacheamos: el análisis sigue funcionando, solo más
 * lento. Nunca debe tirar abajo el análisis por un problema de caché.
 */
export async function getCachedAnalysis(
  fen: string,
  depth: number,
): Promise<EngineResult | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(cacheKey(fen, depth));
      request.onsuccess = () =>
        resolve(request.result as EngineResult | undefined);
      request.onerror = () => reject(request.error as unknown);
    });
  } catch {
    return undefined;
  }
}

export async function setCachedAnalysis(
  fen: string,
  depth: number,
  result: EngineResult,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(result, cacheKey(fen, depth));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as unknown);
    });
  } catch {
    // noop: cachear es una optimización, no un requisito.
  }
}
