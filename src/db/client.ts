import { neon } from "@neondatabase/serverless";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;
export type AtomicQueries = readonly [BatchItem<"pg">, ...BatchItem<"pg">[]];

export interface DatabaseHandle {
  db: Database;
  /** Executa as queries numa única transação. */
  atomic: (queries: AtomicQueries) => Promise<void>;
  close: () => Promise<void>;
}

/** `pglite:<pasta>` roda um Postgres embutido (dev, testes e E2E); vazio = memória. */
export const PGLITE_PREFIX = "pglite:";

/** Carrega o driver sem conectar; a função devolvida abre a conexão. */
export async function loadDatabase(
  url: string | undefined,
): Promise<() => DatabaseHandle> {
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Copie .env.local.example para .env.local e preencha.",
    );
  }

  if (url.startsWith(PGLITE_PREFIX)) {
    const { createPgliteHandle } = await import("./pglite");
    return () => createPgliteHandle(url.slice(PGLITE_PREFIX.length));
  }

  return () => {
    const db = drizzle(neon(url), { schema });
    return {
      db,
      atomic: async (queries) => {
        await db.batch(queries);
      },
      close: async () => {},
    };
  };
}

export async function createDatabase(url: string | undefined): Promise<DatabaseHandle> {
  const open = await loadDatabase(url);
  return open();
}
