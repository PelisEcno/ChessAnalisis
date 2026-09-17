import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../redis.js";
import { ingestUserGames, type Platform } from "../services/ingestGames.js";

export interface IngestJobData {
  platform: Platform;
  username: string;
  limit: number;
}

export const ingestQueue = new Queue<IngestJobData>("ingest", {
  connection: redis,
});

export function startIngestWorker(): Worker<IngestJobData> {
  return new Worker<IngestJobData>(
    "ingest",
    async (job: Job<IngestJobData>) => {
      const { platform, username, limit } = job.data;
      return ingestUserGames(platform, username, limit);
    },
    { connection: redis, concurrency: 2 },
  );
}
