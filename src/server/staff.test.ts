import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { appointmentEvents, appointments, professionalServices } from "@/db/schema";
import { NOW, seedCatalog, seedClient, seedUsers } from "@/test/fixtures";
import { getTestDatabase, resetDatabase } from "@/test/test-db";
import type { SessionUser } from "@/types/domain";

vi.mock("@/db", async () => {
  const { getTestDatabase: open } = await import("@/test/test-db");
  const { db, atomic } = await open();
  return { db, atomic };
});

vi.mock("@/server/notifications", () => ({
  sendNotification: vi.fn(),
  deliverNotification: vi.fn(async () => true),
  isNotificationDeliveryConfigured: vi.fn(() => false),
}));

const { sendNotification } = await import("@/server/notifications");
const {
  changeAppointmentStatus,
  createStaffAppointment,
  rescheduleStaffAppointment,
} = await import("./appointment-service");
const { createPublicBooking } = await import("./booking-service");
const {
  getClientStats,
  getNavigationCounters,
  listAppointmentsInRange,
  listPendingPortalAppointments,
  searchClients,
} = await import("./queries");
const {
  createBlock,
  deleteProfessional,
  deleteService,
  updateProfessional,
} = await import("./registry-service");

let people: Awaited<ReturnType<typeof seedUsers>>;

function appointmentInput(overrides: Record<string, string> = {}) {
  return {
    clientId: "cli-1",
    serviceId: "srv-1",
    professionalId: "pro-1",
    date: "2026-09-02",
    startTime: "10:00",
    ...overrides,
  };
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  await resetDatabase();
  await seedCatalog();
  await seedClient();
  people = await seedUsers();
  vi.mocked(sendNotification).mockClear();
});

describe("agendamentos da equipe", () => {
  it("deriva nome, preço e término do banco e registra quem criou", async () => {
    const { db } = await getTestDatabase();
    const created = await createStaffAppointment(appointmentInput(), people.reception);

    expect(created).toMatchObject({
      endTime: "11:00",
      price: 150,
      clientName: "Carla Souza",
      serviceName: "Limpeza de pele",
      professionalName: "Ana",
    });

    const [row] = await db.select().from(appointments).where(eq(appointments.id, created.id));
    expect(row).toMatchObject({ createdBy: "usr-rec", priceCents: 15000 });
    expect(row.accessTokenHash).toHaveLength(64);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "booking-created", to: "11977770001" }),
    );
  });

  it("recusa conflito e bloqueio de agenda", async () => {
    await createStaffAppointment(appointmentInput(), people.reception);
    await seedClient("cli-2", "(11) 97777-0002", "Outra");

    await expect(
      createStaffAppointment(appointmentInput({ clientId: "cli-2", startTime: "10:30" }), people.reception),
    ).rejects.toThrow(/profissional já possui um atendimento/);

    const { affectedAppointments } = await createBlock(
      { startDate: "2026-09-02", endDate: "2026-09-02", allDay: true, reason: "Feriado municipal" },
      people.admin,
    );
    expect(affectedAppointments).toBe(1);

    await expect(
      createStaffAppointment(appointmentInput({ clientId: "cli-2", startTime: "15:00" }), people.reception),
    ).rejects.toThrow(/Feriado municipal/);
  });

  it("aplica o fluxo de status e as permissões de cada perfil", async () => {
    const created = await createStaffAppointment(appointmentInput(), people.reception);
    const change = (status: "confirmed" | "in-progress" | "completed" | "cancelled", actor: SessionUser) =>
      changeAppointmentStatus({ id: created.id, status }, actor);

    await expect(change("confirmed", people.ana)).rejects.toThrow(/permissão/);
    await expect(change("confirmed", people.reception)).resolves.toMatchObject({ status: "confirmed" });
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: "booking-confirmed" }));

    await expect(change("in-progress", people.bia)).rejects.toThrow(/permissão/);
    await expect(change("in-progress", people.ana)).resolves.toMatchObject({ status: "in-progress" });
    await expect(change("completed", people.ana)).resolves.toMatchObject({ status: "completed" });
    await expect(change("cancelled", people.admin)).rejects.toThrow(/Não é possível mudar/);

    const { db } = await getTestDatabase();
    const events = await db
      .select({ kind: appointmentEvents.kind, actor: appointmentEvents.actorUserId })
      .from(appointmentEvents)
      .where(eq(appointmentEvents.appointmentId, created.id));
    expect(events.map((event) => event.actor)).toEqual(["usr-rec", "usr-rec", "usr-ana", "usr-ana"]);
  });

  it("remarca mantendo o status e liberando o lembrete", async () => {
    const created = await createStaffAppointment(appointmentInput(), people.reception);
    await changeAppointmentStatus({ id: created.id, status: "confirmed" }, people.reception);

    const moved = await rescheduleStaffAppointment(
      { id: created.id, date: "2026-09-03", startTime: "14:00", professionalId: "pro-1" },
      people.reception,
    );
    expect(moved).toMatchObject({ date: "2026-09-03", startTime: "14:00", status: "confirmed" });
  });

  it("a profissional só enxerga os próprios atendimentos", async () => {
    await createStaffAppointment(appointmentInput(), people.reception);
    await createStaffAppointment(
      appointmentInput({ serviceId: "srv-2", professionalId: "pro-2", startTime: "14:00" }),
      people.reception,
    );

    expect(await listAppointmentsInRange("2026-09-01", "2026-09-07", people.reception)).toHaveLength(2);
    expect(
      (await listAppointmentsInRange("2026-09-01", "2026-09-07", people.bia)).map(
        (appointment) => appointment.professionalId,
      ),
    ).toEqual(["pro-2"]);
  });
});

describe("cadastros", () => {
  it("troca os serviços da profissional e propaga o nome aos agendamentos futuros", async () => {
    const { db } = await getTestDatabase();
    const created = await createStaffAppointment(appointmentInput(), people.reception);

    await updateProfessional("pro-1", {
      name: "Ana Paula",
      role: "Esteticista",
      specialties: [],
      serviceIds: ["srv-1", "srv-2"],
      phone: "(11) 99999-0001",
      email: "ana@clinica.test",
      color: "#0f766e",
      active: true,
      workDays: ["Seg", "Ter", "Qua", "Qui", "Sex"],
      workStart: "08:00",
      workEnd: "19:00",
      commissionPercent: 0,
    });

    const links = await db
      .select({ serviceId: professionalServices.serviceId })
      .from(professionalServices)
      .where(eq(professionalServices.professionalId, "pro-1"));
    expect(links.map((link) => link.serviceId).sort()).toEqual(["srv-1", "srv-2"]);

    const [row] = await db.select().from(appointments).where(eq(appointments.id, created.id));
    expect(row.professionalName).toBe("Ana Paula");
  });

  it("não exclui serviço ou profissional com histórico", async () => {
    await createStaffAppointment(appointmentInput(), people.reception);
    await expect(deleteService("srv-1")).rejects.toThrow(/Desative-o/);
    await expect(deleteProfessional("pro-1")).rejects.toThrow(/Desative-a/);
    await expect(deleteService("srv-2")).resolves.toBeUndefined();
  });
});

describe("consultas do painel", () => {
  it("busca clientes sem acento e por trecho do telefone, com indicadores derivados", async () => {
    const { db } = await getTestDatabase();
    await seedClient("cli-2", "(11) 94444-1234", "Mônica Araújo");
    const done = await createStaffAppointment(appointmentInput({ clientId: "cli-2" }), people.reception);
    await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, done.id));
    await createStaffAppointment(
      appointmentInput({ clientId: "cli-2", date: "2026-09-03" }),
      people.reception,
    );

    const byName = await searchClients({ query: "monica", segment: "todas", page: 1, pageSize: 20, today: "2026-09-01" });
    expect(byName.items).toEqual([
      expect.objectContaining({
        id: "cli-2",
        completedAppointments: 1,
        lastVisit: "2026-09-02",
        nextAppointment: { date: "2026-09-03", startTime: "10:00" },
      }),
    ]);

    const byPhone = await searchClients({ query: "1234", segment: "todas", page: 1, pageSize: 20, today: "2026-09-01" });
    expect(byPhone.items.map((client) => client.id)).toEqual(["cli-2"]);

    const withoutAgenda = await searchClients({ query: "", segment: "sem-agenda", page: 1, pageSize: 20, today: "2026-09-01" });
    expect(withoutAgenda.items.map((client) => client.id)).toEqual(["cli-1"]);

    expect(await getClientStats("2026-09-01")).toEqual({ total: 2, withUpcoming: 1, withoutVisits: 1 });
  });

  it("conta pendências do portal só para quem pode confirmá-las", async () => {
    await createPublicBooking(
      {
        firstName: "Maria",
        lastName: "Silva",
        phone: "(11) 98888-7777",
        serviceId: "srv-1",
        professionalId: "pro-1",
        date: "2026-09-02",
        startTime: "10:00",
      },
      { ip: "203.0.113.20" },
    );

    expect(await listPendingPortalAppointments("2026-09-01")).toHaveLength(1);
    await expect(getNavigationCounters(people.reception, "2026-09-01")).resolves.toEqual({
      todayActive: 0,
      portalPending: 1,
    });
    await expect(getNavigationCounters(people.ana, "2026-09-01")).resolves.toEqual({
      todayActive: 0,
      portalPending: 0,
    });
  });
});
