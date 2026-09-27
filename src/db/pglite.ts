import { mkdirSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import type { Database, DatabaseHandle } from "./client";
import * as schema from "./schema";

function createClient(dataDir: string) {
  // O PGlite não cria pastas intermediárias, como `.data` em `./.data/dev`.
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  // As consultas esperam a inicialização (`waitReady`) sozinhas.
  const client = new PGlite(dataDir || "memory://", { extensions: { btree_gist } });
  const db: PgliteDatabase<typeof schema> = drizzle({ client, schema });
  return { client, db };
}

export async function openPglite(dataDir: string) {
  const opened = createClient(dataDir);
  await opened.client.waitReady;
  return opened;
}

export function toDatabaseHandle({
  client,
  db,
}: ReturnType<typeof createClient>): DatabaseHandle {
  return {
    // Mesma API de consultas do driver Neon; só `batch` não existe, por isso `atomic` abaixo.
    db: db as unknown as Database,
    atomic: async (queries) => {
      // PGlite tem uma única conexão, então BEGIN/COMMIT envolve as queries seguintes.
      await db.execute(sql`begin`);
      try {
        for (const query of queries) {
          await (query as unknown as PromiseLike<unknown>);
        }
        await db.execute(sql`commit`);
      } catch (error) {
        await db.execute(sql`rollback`);
        throw error;
      }
    },
    close: () => client.close(),
  };
}

export function createPgliteHandle(dataDir: string): DatabaseHandle {
  const opened = createClient(dataDir);
  // Se a abertura falhar, o erro aparece na primeira consulta, sem rejeição solta.
  opened.client.waitReady.catch(() => {});
  return toDatabaseHandle(opened);
}
