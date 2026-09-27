import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { DatabaseHandle } from "@/db/client";
import { MIGRATIONS_FOLDER } from "@/db/migration-utils";
import { openPglite, toDatabaseHandle } from "@/db/pglite";

let handlePromise: Promise<DatabaseHandle> | undefined;

/** Banco em memória com todas as migrations aplicadas, compartilhado pelo arquivo de teste. */
export function getTestDatabase() {
  handlePromise ??= (async () => {
    const opened = await openPglite("");
    await migrate(opened.db, { migrationsFolder: MIGRATIONS_FOLDER });
    return toDatabaseHandle(opened);
  })();
  return handlePromise;
}

export async function resetDatabase() {
  const { db } = await getTestDatabase();
  await db.execute(sql`
    truncate table appointment_events, appointments, professional_services, schedule_blocks,
      verification_codes, booking_rate_limits, users, clients, services, professionals
    restart identity cascade
  `);
}
