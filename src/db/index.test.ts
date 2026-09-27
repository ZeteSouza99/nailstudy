import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";

import type { DatabaseHandle } from "./client";

const root = await mkdtemp(join(tmpdir(), "db-lazy-"));

afterAll(async () => {
  await (globalThis as { __clinicDb?: DatabaseHandle }).__clinicDb?.close();
  await rm(root, { recursive: true, force: true });
});

it("só abre o banco na primeira consulta", async () => {
  const dataDir = join(root, ".data", "dev");
  process.env.DATABASE_URL = `pglite:${dataDir}`;

  const { db } = await import("./index");
  expect(existsSync(dataDir)).toBe(false);

  const result = await db.execute(sql`select 1 as ok`);
  expect(result.rows).toEqual([{ ok: 1 }]);
  expect(existsSync(dataDir)).toBe(true);
});
