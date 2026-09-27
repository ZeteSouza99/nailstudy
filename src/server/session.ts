import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/types/domain";

import { UserError } from "./errors";

/** Sempre relido do banco: remoção ou troca da conta vale na hora, sem esperar o JWT expirar. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
});

/** Para páginas administrativas: sem sessão, redireciona ao login. */
export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Para Server Actions: devolve erro legível em vez de redirecionar. */
export async function requireActionUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UserError("Sessão expirada. Entre novamente.");
  }
  return user;
}
