import { config } from "dotenv";

import { createDatabase } from "./client";
import { upsertAdmin } from "./user-admin";

config({ path: ".env.local", quiet: true });

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "Defina ADMIN_PASSWORD (mínimo de 10 caracteres) no ambiente ou no .env.local.",
    );
  }

  const email = process.env.ADMIN_EMAIL ?? "admin@nailagenda.com";
  const { db, close } = await createDatabase(process.env.DATABASE_URL);

  try {
    const result = await upsertAdmin(db, {
      email,
      name: process.env.ADMIN_NAME ?? "Administrador",
      password,
    });
    console.log(`${result.created ? "Criado" : "Atualizado"}: ${email} (administrador).`);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
