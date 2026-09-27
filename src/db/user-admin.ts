import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import type { UserRole } from "@/types/domain";

import type { Database } from "./client";
import { professionals, users } from "./schema";

export const PASSWORD_MIN_LENGTH = 10;
export const BCRYPT_COST = 12;

interface UserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  professionalId?: string | null;
}

/** Cria ou atualiza (pelo e-mail) um usuário da equipe. */
export async function upsertUser(db: Database, input: UserInput) {
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

  const professionalId = input.role === "professional" ? input.professionalId ?? null : null;
  if (input.role === "professional") {
    if (!professionalId) {
      throw new Error("Usuários com perfil profissional precisam de --professional-id.");
    }
    const [professional] = await db
      .select({ id: professionals.id })
      .from(professionals)
      .where(eq(professionals.id, professionalId))
      .limit(1);
    if (!professional) {
      throw new Error(`Profissional ${professionalId} não encontrada.`);
    }
  }

  const password = await bcrypt.hash(input.password, BCRYPT_COST);
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ name, password, role: input.role, professionalId })
      .where(eq(users.id, existing.id));
    return { id: existing.id, created: false };
  }

  const id = `usr-${crypto.randomUUID()}`;
  await db
    .insert(users)
    .values({ id, name, email, password, role: input.role, professionalId });
  return { id, created: true };
}
