import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "./client.js";

// "./drizzle" relativo resuelve contra el cwd del proceso, no contra este
// archivo: en el contenedor Docker el cwd es /app, no /app/apps/api. Este
// archivo vive en src/db (dev, vía tsx) o dist/db (prod, compilado); en
// ambos casos "apps/api" queda dos niveles arriba.
const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, "..", "..", "drizzle");

await migrate(db, { migrationsFolder });
await sql.end();
console.log("Migraciones aplicadas.");
