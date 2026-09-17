import { buildApp } from "./app.js";
import { env } from "./env.js";
import { startAnalysisWorker } from "./queues/analysis.js";
import { startIngestWorker } from "./queues/ingest.js";

async function main(): Promise<void> {
  const app = await buildApp();
  const ingestWorker = startIngestWorker();
  const analysisWorker = startAnalysisWorker();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const shutdown = async () => {
    app.log.info("Apagando...");
    await app.close();
    await ingestWorker.close();
    await analysisWorker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
