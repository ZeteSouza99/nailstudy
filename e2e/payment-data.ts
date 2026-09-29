import type { Database } from "../src/db/client";
import { appointments, clients } from "../src/db/schema";
import { addDays, getTodayKey, parseDateKey } from "../src/lib/date";

const today = getTodayKey();
// Outra semana para não ocupar os horários usados por staff.spec.ts.
let future = addDays(today, 35);
while (parseDateKey(future).getDay() !== 3) future = addDays(future, 1);

export const cashierDates = { today, future, old: addDays(today, -365) };

/** Cenários exclusivos do banco descartável dos testes de navegador. */
export async function seedCashierData(db: Database) {
  const people = [
    { id: "cli-e2e-cashier-flow", name: "Caixa Fluxo", phone: "11955553001" },
    { id: "cli-e2e-cashier-refresh", name: "Caixa Atualização", phone: "11955553002" },
    { id: "cli-e2e-cashier-old", name: "Caixa Antigo", phone: "11955553003" },
    { id: "cli-e2e-cashier-mobile", name: "Caixa Mobile", phone: "11955553004" },
  ];
  await db.insert(clients).values(people.map((person) => ({ ...person, phoneDigits: person.phone })));
  await db.insert(appointments).values([
    { id: "apt-e2e-cashier-flow", client: people[0], date: future, startTime: "08:00", endTime: "09:15", status: "in-progress" as const, priceCents: 22000 },
    { id: "apt-e2e-cashier-refresh", client: people[1], date: future, startTime: "10:00", endTime: "11:15", status: "in-progress" as const, priceCents: 22000 },
    { id: "apt-e2e-cashier-old-1", client: people[2], date: cashierDates.old, startTime: "08:00", endTime: "09:15", status: "completed" as const, priceCents: 15000 },
    { id: "apt-e2e-cashier-old-2", client: people[2], date: cashierDates.old, startTime: "10:00", endTime: "11:15", status: "completed" as const, priceCents: 8000 },
    { id: "apt-e2e-cashier-mobile", client: people[3], date: cashierDates.old, startTime: "15:00", endTime: "16:15", status: "completed" as const, priceCents: 15000 },
  ].map(({ client, ...appointment }) => ({
    ...appointment,
    clientId: client.id,
    clientName: client.name,
    serviceId: "srv-001",
    serviceName: "Esmaltação em gel premium",
    professionalId: "pro-001",
    professionalName: "Erika Queiroz",
    source: "staff" as const,
  })));
}
