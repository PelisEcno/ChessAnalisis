import { Redis } from "ioredis";
import { env } from "./env.js";

// maxRetriesPerRequest: null es lo que pide BullMQ explícitamente para las
// conexiones que usan sus colas/workers (si no, tira un warning y puede
// perder jobs en reconexiones). lazyConnect: true evita que solo importar
// este módulo (p.ej. al testear algo que lo importa transitivamente) ya
// dispare una conexión de red; se conecta sola en el primer comando.
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
