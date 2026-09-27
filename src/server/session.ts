import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";
import type { SessionUser } from "@/types/domain";

import { UserError } from "./errors";

/** Sempre relido do banco: mudança de perfil ou remoção vale na hora, sem esperar o JWT expirar. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      professionalId: users.professionalId,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ?? null;
});

/** Para páginas: sem sessão vai ao login; sem permissão, à visão geral. */
export async function requirePageUser(permission?: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (permission && !can(user.role, permission)) redirect("/");
  return user;
}

/** Para Server Actions: devolve erro legível em vez de redirecionar. */
export async function requireActionUser(permission?: Permission) {
  const user = await getCurrentUser();
  if (!user) {
    throw new UserError("Sessão expirada. Entre novamente.");
  }
  if (permission && !can(user.role, permission)) {
    throw new UserError("Você não tem permissão para esta ação.");
  }
  return user;
}
