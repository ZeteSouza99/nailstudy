import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appointments } from "@/db/schema";

import { accessTokenHashFor, createAccessToken } from "./tokens";

/**
 * Gera os links (tokens HMAC) dos agendamentos. Registros anteriores à
 * migração tinham token aleatório: o hash é atualizado para o novo formato.
 */
export async function ensureAccessTokens(
  rows: ReadonlyArray<{ id: string; accessTokenHash: string | null }>,
) {
  const tokens = new Map<string, string>();

  for (const row of rows) {
    const expectedHash = accessTokenHashFor(row.id);
    if (row.accessTokenHash !== expectedHash) {
      await db
        .update(appointments)
        .set({ accessTokenHash: expectedHash })
        .where(eq(appointments.id, row.id));
    }
    tokens.set(row.id, createAccessToken(row.id));
  }

  return tokens;
}
