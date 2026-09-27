import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import type { Database } from "./client";
import { users } from "./schema";

export const PASSWORD_MIN_LENGTH = 10;
export const BCRYPT_COST = 12;

interface AdminInput {
  email: string;
  name: string;
  password: string;
}

/** Cria a conta administrativa ou atualiza a única conta já existente. */
export async function upsertAdmin(db: Database, input: AdminInput) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("E-mail inválido.");
  }
  if (name.length < 2) {
    throw new Error("Informe o nome do usuário.");
  }
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }

  const password = await bcrypt.hash(input.password, BCRYPT_COST);
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ name, email, password })
      .where(eq(users.id, existing.id));
    return { id: existing.id, created: false };
  }

  const id = "usr-admin";
  await db.insert(users).values({ id, name, email, password });
  return { id, created: true };
}
