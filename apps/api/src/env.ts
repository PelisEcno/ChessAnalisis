import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET debe tener al menos 32 caracteres"),
  /** Origen(es) permitidos para CORS, separados por coma (p.ej. "http://localhost:3000"). */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  CONTACT_EMAIL: z.string().default("no-configurado"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Base pública de la API, usada para armar la callback URL de OAuth. */
  API_BASE_URL: z.url().default("http://localhost:4000"),
  /**
   * Threads UCI por instancia de Stockfish. Con concurrency=2 en la cola de
   * análisis (ver queues/analysis.ts), el default de 4 satura una máquina
   * de 8 cores; ajustar según el hardware disponible.
   */
  STOCKFISH_THREADS: z.coerce.number().int().positive().default(4),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Variables de entorno inválidas:");
    console.error(z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
