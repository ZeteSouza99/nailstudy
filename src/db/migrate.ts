import { config } from "dotenv";

import { openMigrationConnection } from "./migration-utils";

config({ path: ".env.local", quiet: true });

async function main() {
  const connection = await openMigrationConnection(process.env.DATABASE_URL);
  try {
    await connection.migrate();
    console.log("Migrations aplicadas.");
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
