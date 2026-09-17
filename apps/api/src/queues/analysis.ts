import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../redis.js";
import { analyzeAndStoreGame } from "../services/analyzeAndStore.js";

export interface AnalysisJobData {
  gameId: string;
  depth: number;
}

export const analysisQueue = new Queue<AnalysisJobData>("analysis", {
  connection: redis,
});

export function startAnalysisWorker(): Worker<AnalysisJobData> {
  return new Worker<AnalysisJobData>(
    "analysis",
    async (job: Job<AnalysisJobData>) => {
      await analyzeAndStoreGame(job.data.gameId, job.data.depth);
    },
    // Concurrencia baja: cada job spawnea un proceso de Stockfish nativo,
    // que ya usa varios recursos por sí solo.
    { connection: redis, concurrency: 2 },
  );
}
