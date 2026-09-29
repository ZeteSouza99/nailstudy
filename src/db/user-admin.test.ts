import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { users } from "@/db/schema";
import { getTestDatabase, resetDatabase } from "@/test/test-db";

import { upsertAdmin } from "./user-admin";

beforeEach(resetDatabase);
afterAll(async () => (await getTestDatabase()).close());

describe("conta administrativa", () => {
  it("grava usuário e hash bcrypt, preservando a conta ao trocar o acesso", async () => {
    const { db } = await getTestDatabase();
    const first = await upsertAdmin(db, {
      username: "Admin", name: "Admin", email: "admin@exemplo.test", password: "senha-anterior",
    });
    const updated = await upsertAdmin(db, {
      username: " Erika ", name: "Erika", email: "admin@exemplo.test", password: "senha123",
    });
    const rows = await db.select().from(users);
    expect(updated).toEqual({ id: first.id, created: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("Erika");
    expect(rows[0].name).toBe("Erika");
    expect(rows[0].password).not.toBe("senha123");
    expect(await bcrypt.compare("senha123", rows[0].password)).toBe(true);
    expect(await bcrypt.compare("senha-anterior", rows[0].password)).toBe(false);
  });

  it("recusa usuário inválido e senha abaixo do mínimo sem criar a conta", async () => {
    const { db } = await getTestDatabase();
    const input = { name: "Erika", email: "admin@exemplo.test", password: "senha123" };
    await expect(upsertAdmin(db, { ...input, username: "nome com espaço" })).rejects.toThrow("O usuário deve");
    await expect(upsertAdmin(db, { ...input, password: "curta" })).rejects.toThrow("8 caracteres");
    expect(await db.select().from(users)).toHaveLength(0);
  });
});
