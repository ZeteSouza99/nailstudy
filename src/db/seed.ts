import { config } from "dotenv";

import { createDatabase } from "./client";
import { seedDemoData } from "./demo-data";

config({ path: ".env.local", quiet: true });

async function main() {
  const { db, close } = await createDatabase(process.env.DATABASE_URL);
  try {
    await seedDemoData(db);
    console.log("Seed concluído.");
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error("Erro no seed:", error);
  process.exit(1);
});
