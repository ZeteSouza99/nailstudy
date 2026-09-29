import { config } from "dotenv";

import { createDatabase } from "./client";
import { users } from "./schema";
import { upsertAdmin } from "./user-admin";

config({ path: ".env.local", quiet: true });

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "Defina ADMIN_PASSWORD (mínimo de 8 caracteres) no ambiente ou no .env.local.",
    );
  }

  const { db, close } = await createDatabase(process.env.DATABASE_URL);

  try {
    const [existing] = await db.select({ email: users.email }).from(users).limit(1);
    const result = await upsertAdmin(db, {
      username: process.env.ADMIN_USERNAME ?? "Erika",
      email: process.env.ADMIN_EMAIL ?? existing?.email ?? "admin@nailagenda.com",
      name: process.env.ADMIN_NAME ?? "Erika",
      password,
    });
    console.log(`${result.created ? "Criado" : "Atualizado"}: ${process.env.ADMIN_USERNAME ?? "Erika"} (administradora).`);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
