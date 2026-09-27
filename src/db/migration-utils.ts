import { sql, type SQL } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { PGLITE_PREFIX } from "./client";

export const MIGRATIONS_FOLDER = "drizzle";

interface Executor {
  execute(query: SQL): PromiseLike<unknown>;
}

async function selectRows(db: Executor, query: SQL) {
  const result = (await db.execute(query)) as { rows?: unknown[] } | unknown[];
  return Array.isArray(result) ? result : (result.rows ?? []);
}

/**
 * Registra a migration 0000 como aplicada em bancos criados pelo antigo
 * `drizzle-kit push`, para que `db:migrate` aplique só as seguintes.
 */
export async function markBaselineApplied(
  db: Executor,
): Promise<"marked" | "already-migrated"> {
  const [baseline] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  if (!baseline) {
    throw new Error("Migration baseline não encontrada em ./drizzle.");
  }

  await db.execute(sql`create schema if not exists drizzle`);
  await db.execute(sql`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);

  const applied = await selectRows(
    db,
    sql`select 1 from drizzle.__drizzle_migrations limit 1`,
  );
  if (applied.length > 0) return "already-migrated";

  const legacy = await selectRows(
    db,
    sql`select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'appointments' and column_name = 'access_token'`,
  );
  if (legacy.length === 0) {
    throw new Error(
      "Este banco não está no formato do antigo db:push. Rode apenas `npm run db:migrate`.",
    );
  }

  await db.execute(sql`
    insert into drizzle.__drizzle_migrations (hash, created_at)
    values (${baseline.hash}, ${baseline.folderMillis})
  `);
  return "marked";
}

/** Conexão transacional para migrations: Pool WebSocket no Neon ou PGlite local. */
export async function openMigrationConnection(url: string | undefined) {
  if (!url) {
    throw new Error("DATABASE_URL não configurada.");
  }

  if (url.startsWith(PGLITE_PREFIX)) {
    const { openPglite } = await import("./pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { client, db } = await openPglite(url.slice(PGLITE_PREFIX.length));
    return {
      db,
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      close: () => client.close(),
    };
  }

  if (typeof WebSocket === "undefined") {
    throw new Error("As migrations no Neon usam WebSocket: rode com Node.js 22 ou superior.");
  }

  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool });

  return {
    db,
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => pool.end(),
  };
}
