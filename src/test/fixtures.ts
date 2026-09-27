import { eq } from "drizzle-orm";

import { getTestDatabase } from "@/test/test-db";
import { clients, professionalServices, professionals, services, users } from "@/db/schema";
import type { SessionUser } from "@/types/domain";

/** Terça, 01/09/2026, 09:00 em São Paulo. */
export const NOW = new Date("2026-09-01T12:00:00Z");

export async function seedCatalog() {
  const { db } = await getTestDatabase();

  await db.insert(services).values([
    {
      id: "srv-1",
      name: "Limpeza de pele",
      category: "Facial",
      description: "Limpeza profunda",
      durationMinutes: 60,
      bufferMinutes: 0,
      priceCents: 15000,
      status: "active",
      color: "#0f766e",
    },
    {
      id: "srv-2",
      name: "Drenagem",
      category: "Corporal",
      description: "Pedicure completa",
      durationMinutes: 60,
      bufferMinutes: 15,
      priceCents: 18000,
      status: "active",
      color: "#7c3aed",
    },
  ]);

  await db.insert(professionals).values([
    {
      id: "pro-1",
      name: "Ana",
      role: "Esteticista",
      phone: "(11) 99999-0001",
      email: "ana@clinica.test",
      color: "#0f766e",
      workDays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    },
    {
      id: "pro-2",
      name: "Bia",
      role: "Massoterapeuta",
      phone: "(11) 99999-0002",
      email: "bia@clinica.test",
      color: "#7c3aed",
      workDays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    },
  ]);

  await db.insert(professionalServices).values([
    { professionalId: "pro-1", serviceId: "srv-1" },
    { professionalId: "pro-2", serviceId: "srv-2" },
  ]);
}

export async function seedClient(id = "cli-1", phone = "(11) 97777-0001", name = "Carla Souza") {
  const { db } = await getTestDatabase();
  await db.insert(clients).values({ id, name, phone, phoneDigits: phone.replace(/\D/g, "") });
  return id;
}

export async function seedAdmin(): Promise<SessionUser> {
  const { db } = await getTestDatabase();
  const admin = { id: "usr-admin", name: "Admin", email: "admin@clinica.test" };
  await db.insert(users).values({ ...admin, password: "hash" });
  return admin;
}

/** Compatibilidade para cenários financeiros: todos os atores apontam para a única conta. */
export async function seedUsers() {
  const admin = await seedAdmin();
  return { admin, reception: admin, ana: admin, bia: admin };
}

export async function getClientByPhone(phoneDigits: string) {
  const { db } = await getTestDatabase();
  const [client] = await db.select().from(clients).where(eq(clients.phoneDigits, phoneDigits));
  return client;
}
