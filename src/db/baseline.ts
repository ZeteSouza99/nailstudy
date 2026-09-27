import { config } from "dotenv";

import { markBaselineApplied, openMigrationConnection } from "./migration-utils";

config({ path: ".env.local", quiet: true });

async function main() {
  const connection = await openMigrationConnection(process.env.DATABASE_URL);
  try {
    const result = await markBaselineApplied(connection.db);
    console.log(
      result === "marked"
        ? "Baseline registrada. Agora rode `npm run db:migrate`."
        : "Este banco já usa migrations; nada a fazer.",
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
