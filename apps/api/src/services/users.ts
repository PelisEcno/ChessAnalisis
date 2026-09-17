import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export async function findOrCreateUserByEmail(
  email: string,
): Promise<{ id: string; email: string }> {
  const normalized = email.trim().toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalized),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ email: normalized })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Carrera con otra request creando el mismo usuario al mismo tiempo.
  const nowExisting = await db.query.users.findFirst({
    where: eq(users.email, normalized),
  });
  if (!nowExisting) {
    throw new Error(`No se pudo crear ni encontrar el usuario ${normalized}`);
  }
  return nowExisting;
}
