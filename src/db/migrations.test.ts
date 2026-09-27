import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getPgError } from "@/server/errors";
import { hashToken } from "@/server/tokens";

import { markBaselineApplied, MIGRATIONS_FOLDER } from "./migration-utils";
import { openPglite } from "./pglite";

type Opened = Awaited<ReturnType<typeof openPglite>>;

const legacyToken = "token-legado-abcdefghijklmnopqrstuvwxyz0123456789";

async function rows<T>(opened: Opened, query: string) {
  return (await opened.client.query<T>(query)).rows;
}

/** Reproduz um banco criado pelo antigo `db:push`, com dados no formato anterior. */
async function createLegacyDatabase() {
  const opened = await openPglite("");
  const [baseline] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  for (const statement of baseline.sql) {
    await opened.client.exec(statement);
  }

  await opened.client.exec(`
    insert into services (id, name, category, description, duration_minutes, price, status, color) values
      ('srv-1', 'Limpeza', 'Facial', 'Limpeza profunda', 60, 150.50, 'active', '#0f766e'),
      ('srv-2', 'Laser', 'Depilação', 'Sessão de laser', 30, 99.99, 'active', '#2563eb');

    insert into professionals (id, name, role, specialties, service_ids, phone, email, status, color, work_days) values
      ('pro-1', 'Ana', 'Esteticista', '{}', '{srv-1,srv-2,srv-removido}', '(11) 99999-0001',
       'ana@clinica.test', 'off-duty', '#0f766e', '{Seg,Ter,Qua,Qui,Sex}');

    insert into clients (id, name, phone, phone_digits, email, birth_date, last_visit, total_appointments, tags) values
      ('cli-staff', 'Maria Silva', '(11) 98888-7777', null, 'maria@email.test', '1990-01-01', null, 3, '{VIP,Nova cliente}'),
      ('cli-portal', 'Maria S.', '(11) 98888-7777', '11988887777', '', '2026-09-01', null, 0, '{Nova cliente,Portal}'),
      ('cli-intl', 'Joana', '+55 11 97777-6666', null, 'joana@email.test', '1985-05-05', null, 0, '{}');

    insert into appointments (id, date, start_time, end_time, client_id, client_name, service_id, service_name,
      professional_id, professional_name, status, price, source, access_token) values
      ('apt-portal', '2026-10-06', '10:00', '11:00', 'cli-portal', 'Maria S.', 'srv-1', 'Limpeza',
       'pro-1', 'Ana', 'scheduled', 150.50, 'portal', '${legacyToken}'),
      ('apt-staff', '2026-10-07', '10:00', '11:00', 'cli-staff', 'Maria Silva', 'srv-1', 'Limpeza',
       'pro-1', 'Ana', 'confirmed', 150.50, 'staff', null);

    insert into users (id, name, email, password, role) values
      ('usr-admin', 'Admin', 'admin@clinica.test', 'hash', 'admin'),
      ('usr-rec', 'Recepção', 'recepcao@clinica.test', 'hash', 'receptionist');
  `);

  return opened;
}

describe("migrations", () => {
  let legacy: Opened;

  beforeAll(async () => {
    legacy = await createLegacyDatabase();
    await expect(markBaselineApplied(legacy.db)).resolves.toBe("marked");
    await migrate(legacy.db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterAll(async () => {
    await legacy.client.close();
  });

  it("não marca a baseline duas vezes", async () => {
    await expect(markBaselineApplied(legacy.db)).resolves.toBe("already-migrated");
  });

  it("une fichas duplicadas pelo telefone e normaliza os dígitos", async () => {
    const clients = await rows<{ id: string; phone_digits: string; email: string | null; tags: string[] }>(
      legacy,
      "select id, phone_digits, email, tags from clients order by id",
    );

    expect(clients).toEqual([
      { id: "cli-intl", phone_digits: "11977776666", email: "joana@email.test", tags: [] },
      { id: "cli-staff", phone_digits: "11988887777", email: "maria@email.test", tags: ["VIP"] },
    ]);

    const moved = await rows<{ client_id: string }>(
      legacy,
      "select client_id from appointments where id = 'apt-portal'",
    );
    expect(moved[0].client_id).toBe("cli-staff");
  });

  it("converte preços para centavos e serviços da profissional para a tabela de vínculo", async () => {
    expect(
      await rows(legacy, "select id, price_cents from services order by id"),
    ).toEqual([
      { id: "srv-1", price_cents: 15050 },
      { id: "srv-2", price_cents: 9999 },
    ]);
    expect(
      await rows(legacy, "select service_id from professional_services order by service_id"),
    ).toEqual([{ service_id: "srv-1" }, { service_id: "srv-2" }]);
    expect(await rows(legacy, "select active from professionals")).toEqual([{ active: true }]);
  });

  it("mantém válidos os links já enviados, guardando só o hash", async () => {
    const [appointment] = await rows<{ access_token_hash: string }>(
      legacy,
      "select access_token_hash from appointments where id = 'apt-portal'",
    );
    expect(appointment.access_token_hash).toBe(hashToken(legacyToken));

    const legacyColumns = await rows(
      legacy,
      `select column_name from information_schema.columns
       where table_name = 'appointments' and column_name in ('access_token', 'price')`,
    );
    expect(legacyColumns).toHaveLength(0);
  });

  it("registra o histórico inicial e preserva somente a administradora", async () => {
    expect(await rows(legacy, "select count(*)::int as total from appointment_events")).toEqual([
      { total: 2 },
    ]);
    expect(await rows(legacy, "select id, singleton_key from users")).toEqual([
      { id: "usr-admin", singleton_key: 1 },
    ]);
    expect(
      await rows(
        legacy,
        `select column_name from information_schema.columns
         where table_name = 'users' and column_name in ('role', 'professional_id')`,
      ),
    ).toHaveLength(0);
  });

  it("recusa uma segunda conta administrativa no banco", async () => {
    const error = await legacy.client
      .exec(
        `insert into users (id, name, email, password)
         values ('usr-outro', 'Outro', 'outro@clinica.test', 'hash')`,
      )
      .catch((caught: unknown) => caught);

    expect(getPgError(error)?.code).toBe("23505");
  });

  it("recusa no banco atendimentos sobrepostos da mesma profissional", async () => {
    const error = await legacy.client
      .exec(`
        insert into appointments (id, date, start_time, end_time, client_id, client_name, service_id,
          service_name, professional_id, professional_name, status, price_cents, source)
        values ('apt-conflito', '2026-10-06', '10:30', '11:30', 'cli-intl', 'Joana', 'srv-1',
          'Limpeza', 'pro-1', 'Ana', 'scheduled', 15050, 'staff')
      `)
      .catch((caught: unknown) => caught);

    expect(getPgError(error)?.constraint).toBe("appointments_professional_no_overlap");
  });

  it("permite o mesmo horário quando o anterior foi cancelado", async () => {
    await legacy.client.exec("update appointments set status = 'cancelled' where id = 'apt-portal'");
    await expect(
      legacy.client.exec(`
        insert into appointments (id, date, start_time, end_time, client_id, client_name, service_id,
          service_name, professional_id, professional_name, status, price_cents, source)
        values ('apt-novo', '2026-10-06', '10:00', '11:00', 'cli-intl', 'Joana', 'srv-1',
          'Limpeza', 'pro-1', 'Ana', 'scheduled', 15050, 'staff')
      `),
    ).resolves.toBeDefined();
  });

  it("cria um banco novo do zero com todas as migrations", async () => {
    const fresh = await openPglite("");
    await migrate(fresh.db, { migrationsFolder: MIGRATIONS_FOLDER });
    const tables = await fresh.db.execute(
      sql`select count(*)::int as total from information_schema.tables where table_schema = 'public'`,
    );
    expect(tables.rows[0]).toEqual({ total: 13 });
    await fresh.client.close();
  });

  it("abre banco local em pasta que ainda não existe", async () => {
    const root = await mkdtemp(join(tmpdir(), "pglite-"));
    try {
      const local = await openPglite(join(root, ".data", "dev"));
      await expect(local.client.query("select 1 as ok")).resolves.toMatchObject({
        rows: [{ ok: 1 }],
      });
      await local.client.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
