import { parseArgs } from "node:util";

import { config } from "dotenv";

import { userRoles } from "@/lib/permissions";
import type { UserRole } from "@/types/domain";

import { createDatabase } from "./client";
import { upsertUser } from "./user-admin";

config({ path: ".env.local", quiet: true });

const usage = `Uso:
  USER_PASSWORD=<senha> npm run db:create-user -- --email <email> --name <nome> --role <admin|receptionist|professional> [--professional-id <id>]

A senha vem de USER_PASSWORD para não ficar no histórico do terminal.`;

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      role: { type: "string" },
      "professional-id": { type: "string" },
    },
  });

  const role = values.role as UserRole | undefined;
  const password = process.env.USER_PASSWORD;

  if (!values.email || !values.name || !role || !userRoles.includes(role) || !password) {
    console.error(usage);
    process.exit(1);
  }

  const { db, close } = await createDatabase(process.env.DATABASE_URL);
  try {
    const result = await upsertUser(db, {
      email: values.email,
      name: values.name,
      password,
      role,
      professionalId: values["professional-id"],
    });
    console.log(`${result.created ? "Criado" : "Atualizado"}: ${values.email} (${role}).`);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
