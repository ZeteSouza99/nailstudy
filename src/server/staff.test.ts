import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { appointmentEvents, appointments, professionalServices } from "@/db/schema";
import { NOW, seedCatalog, seedClient, seedAdmin } from "@/test/fixtures";
import { getTestDatabase, resetDatabase } from "@/test/test-db";

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
  listProfessionals,
  searchClients,
} = await import("./queries");
const {
  createBlock,
  createProfessional,
  createService,
  deleteProfessional,
  deleteService,
  updateProfessional,
  updateStudioSettings,
} = await import("./registry-service");

let admin: Awaited<ReturnType<typeof seedAdmin>>;

function appointmentInput(overrides: Record<string, string> = {}) {
  return {
    clientId: "cli-1",
    serviceId: "srv-1",
    professionalId: "pro-001",
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
  admin = await seedAdmin();
  vi.mocked(sendNotification).mockClear();
});

describe("agendamentos da equipe", () => {
  it("deriva nome, preço e término do banco e registra quem criou", async () => {
    const { db } = await getTestDatabase();
    const created = await createStaffAppointment(appointmentInput(), admin);

    expect(created).toMatchObject({
      endTime: "11:00",
      price: 150,
      clientName: "Carla Souza",
      serviceName: "Limpeza de pele",
      professionalName: "Erika Queiroz",
    });

    const [row] = await db.select().from(appointments).where(eq(appointments.id, created.id));
    expect(row).toMatchObject({ createdBy: "usr-admin", priceCents: 15000 });
    expect(row.accessTokenHash).toHaveLength(64);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "booking-created", to: "11977770001" }),
    );
  });

  it("recusa conflito e bloqueio de agenda", async () => {
    await createStaffAppointment(appointmentInput(), admin);
    await seedClient("cli-2", "(11) 97777-0002", "Outra");

    await expect(
      createStaffAppointment(appointmentInput({ clientId: "cli-2", startTime: "10:30" }), admin),
    ).rejects.toThrow(/profissional já possui um atendimento/);

    const { affectedAppointments } = await createBlock(
      { startDate: "2026-09-02", endDate: "2026-09-02", allDay: true, reason: "Feriado municipal" },
      admin,
    );
    expect(affectedAppointments).toBe(1);

    await expect(
      createStaffAppointment(appointmentInput({ clientId: "cli-2", startTime: "15:00" }), admin),
    ).rejects.toThrow(/Feriado municipal/);
  });

  it("aplica o fluxo de status para a administradora", async () => {
    const created = await createStaffAppointment(appointmentInput(), admin);
    const change = (status: "confirmed" | "in-progress" | "completed" | "cancelled") =>
      changeAppointmentStatus({ id: created.id, status }, admin);

    await expect(change("confirmed")).resolves.toMatchObject({ status: "confirmed" });
    expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: "booking-confirmed" }));

    await expect(change("in-progress")).resolves.toMatchObject({ status: "in-progress" });
    await expect(change("completed")).resolves.toMatchObject({ status: "completed" });
    await expect(change("cancelled")).rejects.toThrow(/Não é possível mudar/);

    const { db } = await getTestDatabase();
    const events = await db
      .select({ kind: appointmentEvents.kind, actor: appointmentEvents.actorUserId })
      .from(appointmentEvents)
      .where(eq(appointmentEvents.appointmentId, created.id));
    expect(events.map((event) => event.actor)).toEqual([
      "usr-admin",
      "usr-admin",
      "usr-admin",
      "usr-admin",
    ]);
  });

  it("remarca mantendo o status e liberando o lembrete", async () => {
    const created = await createStaffAppointment(appointmentInput(), admin);
    await changeAppointmentStatus({ id: created.id, status: "confirmed" }, admin);

    const moved = await rescheduleStaffAppointment(
      { id: created.id, date: "2026-09-03", startTime: "14:00", professionalId: "pro-001" },
      admin,
    );
    expect(moved).toMatchObject({ date: "2026-09-03", startTime: "14:00", status: "confirmed" });
  });

  it("a administradora enxerga todos os atendimentos", async () => {
    await createStaffAppointment(appointmentInput(), admin);
    await createStaffAppointment(
      appointmentInput({ serviceId: "srv-2", professionalId: "pro-2", startTime: "14:00" }),
      admin,
    );

    expect(await listAppointmentsInRange("2026-09-01", "2026-09-07")).toHaveLength(2);
  });
});

describe("cadastros", () => {
  it("mantém Erika e todos os serviços ao receber um formulário antigo", async () => {
    const { db } = await getTestDatabase();
    const created = await createStaffAppointment(appointmentInput(), admin);

    await updateProfessional("pro-001", {
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
      .where(eq(professionalServices.professionalId, "pro-001"));
    expect(links.map((link) => link.serviceId).sort()).toEqual(["srv-1", "srv-2"]);

    const [row] = await db.select().from(appointments).where(eq(appointments.id, created.id));
    expect(row.professionalName).toBe("Erika Queiroz");
  });

  it("não exclui serviço ou profissional com histórico", async () => {
    await createStaffAppointment(appointmentInput(), admin);
    await expect(deleteService("srv-1")).rejects.toThrow(/Desative-o/);
    await expect(deleteProfessional()).rejects.toThrow(/única profissional/);
    await expect(deleteService("srv-2")).resolves.toBeUndefined();
  });
});

describe("estúdio com uma única profissional", () => {
  it("ignora a escolha antiga de profissional e impede horários simultâneos", async () => {
    expect((await listProfessionals()).map((professional) => professional.id)).toEqual(["pro-001"]);
    const created = await createStaffAppointment(appointmentInput({ professionalId: "pro-2" }), admin);
    expect(created).toMatchObject({ professionalId: "pro-001", professionalName: "Erika Queiroz" });
    await seedClient("cli-2", "11977770002", "Outra cliente");
    await expect(createStaffAppointment(appointmentInput({ professionalId: "pro-2", clientId: "cli-2", startTime: "10:30" }), admin)).rejects.toThrow(/já possui um atendimento/);
  });

  it("considera os registros arquivados na disponibilidade da agenda única", async () => {
    const { db } = await getTestDatabase();
    const created = await createStaffAppointment(appointmentInput(), admin);
    await db.update(appointments).set({ professionalId: "pro-2", professionalName: "Cadastro antigo" }).where(eq(appointments.id, created.id));
    await seedClient("cli-2", "11977770002", "Outra cliente");
    await expect(createStaffAppointment(appointmentInput({ clientId: "cli-2", startTime: "10:30" }), admin)).rejects.toThrow(/já possui um atendimento/);
  });

  it("vincula novos serviços à Erika e bloqueia criar ou excluir profissionais", async () => {
    const service = await createService({ name: "Nail art", category: "Unhas", description: "Decoração", durationMinutes: 30, bufferMinutes: 0, price: 40, status: "active", color: "#83423e" });
    expect((await listProfessionals())[0].serviceIds).toContain(service.id);
    await expect(createProfessional()).rejects.toThrow(/apenas Erika Queiroz/);
    await expect(deleteProfessional()).rejects.toThrow(/não pode ser excluída/);
  });

  it("atualiza os horários da Erika sem habilitar os cadastros antigos", async () => {
    await updateStudioSettings({ active: true, workDays: ["Seg", "Qua"], workStart: "09:00", workEnd: "18:00", breakStart: "12:00", breakEnd: "13:00" });
    expect(await listProfessionals()).toMatchObject([{ id: "pro-001", name: "Erika Queiroz", workDays: ["Seg", "Qua"], workStart: "09:00", breakStart: "12:00" }]);
    await expect(createStaffAppointment(appointmentInput({ date: "2026-09-03" }), admin)).rejects.toThrow();
  });
});

describe("consultas do painel", () => {
  it("busca clientes sem acento e por trecho do telefone, com indicadores derivados", async () => {
    const { db } = await getTestDatabase();
    await seedClient("cli-2", "(11) 94444-1234", "Mônica Araújo");
    const done = await createStaffAppointment(appointmentInput({ clientId: "cli-2" }), admin);
    await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, done.id));
    await createStaffAppointment(
      appointmentInput({ clientId: "cli-2", date: "2026-09-03" }),
      admin,
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

  it("conta pendências do portal para a administradora", async () => {
    await createPublicBooking(
      {
        firstName: "Maria",
        lastName: "Silva",
        phone: "(11) 98888-7777",
        serviceId: "srv-1",
        professionalId: "pro-001",
        date: "2026-09-02",
        startTime: "10:00",
      },
      { ip: "203.0.113.20" },
    );

    expect(await listPendingPortalAppointments("2026-09-01")).toHaveLength(1);
    await expect(getNavigationCounters("2026-09-01")).resolves.toEqual({
      todayActive: 0,
      portalPending: 1,
    });
  });
});
