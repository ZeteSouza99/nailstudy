import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

import { createDatabase } from "../src/db/client";
import { seedDemoData } from "../src/db/demo-data";
import { openMigrationConnection } from "../src/db/migration-utils";
import { upsertAdmin } from "../src/db/user-admin";

import { E2E_DATABASE_DIR, e2eEnv, E2E_PORT, e2eUsers } from "./env";
import { seedCashierData } from "./payment-data";

/**
 * Sobe a aplicação para os testes E2E sobre um Postgres embutido descartável:
 * nada toca o banco real configurado no .env.local.
 */
async function prepareDatabase() {
  await rm(E2E_DATABASE_DIR, { recursive: true, force: true });

  const connection = await openMigrationConnection(e2eEnv.DATABASE_URL);
  await connection.migrate();
  await connection.close();

  process.env.TOKEN_SECRET = e2eEnv.AUTH_SECRET;
  const { db, close } = await createDatabase(e2eEnv.DATABASE_URL);
  await seedDemoData(db);
  await seedCashierData(db);
  await upsertAdmin(db, e2eUsers.admin);
  await close();
}

/** Comandos fixos, sem entrada externa; o shell é necessário para resolver o npx no Windows. */
function run(command: string, env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, { stdio: "inherit", shell: true, env });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} saiu com ${code}`)),
    );
  });
}

async function main() {
  await prepareDatabase();

  // O build não consulta o banco; o endereço fictício evita abrir o PGlite em vários workers.
  await run("npx next build", {
    ...process.env,
    ...e2eEnv,
    DATABASE_URL: "postgresql://build:build@localhost/build",
  });
  await run(`npx next start --port ${E2E_PORT}`, { ...process.env, ...e2eEnv });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
