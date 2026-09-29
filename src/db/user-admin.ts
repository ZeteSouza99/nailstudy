import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import type { Database } from "./client";
import { users } from "./schema";

export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_COST = 12;

interface AdminInput {
  username?: string;
  email: string;
  name: string;
  password: string;
}

/** Cria a conta administrativa ou atualiza a única conta já existente. */
export async function upsertAdmin(db: Database, input: AdminInput) {
  const username = (input.username ?? "Erika").trim();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new Error("O usuário deve ter de 3 a 40 letras, números, pontos, traços ou sublinhados.");
  }

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
      .set({ username, name, email, password })
      .where(eq(users.id, existing.id));
    return { id: existing.id, created: false };
  }

  const id = "usr-admin";
  await db.insert(users).values({ id, username, name, email, password });
  return { id, created: true };
}
