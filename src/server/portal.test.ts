import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { appointmentEvents, appointments, clients, professionals } from "@/db/schema";
import { getClientByPhone, NOW, seedCatalog, seedClient } from "@/test/fixtures";
import { getTestDatabase, resetDatabase } from "@/test/test-db";

vi.mock("@/db", async () => {
  const { getTestDatabase: open } = await import("@/test/test-db");
  const { db, atomic } = await open();
  return { db, atomic };
});

vi.mock("@/server/notifications", () => ({
  sendNotification: vi.fn(),
  deliverNotification: vi.fn(async () => true),
  isNotificationDeliveryConfigured: vi.fn(() => true),
}));

const { sendNotification, deliverNotification } = await import("@/server/notifications");
const {
  cancelPublicBooking,
  createPublicBooking,
  listAvailability,
  reschedulePublicBooking,
} = await import("./booking-service");
const { findAppointmentByToken, getBookingCatalog } = await import("./portal-queries");
const { requestRecoveryCode, verifyRecoveryCode } = await import("./recovery-service");
const { sendDueReminders } = await import("./reminder-service");
const { createClient } = await import("./registry-service");
const { toUserMessage } = await import("./errors");

const ctx = { ip: "203.0.113.10" };

function booking(overrides: Partial<Parameters<typeof createPublicBooking>[0]> = {}) {
  return {
    firstName: "Maria",
    lastName: "Silva",
    phone: "(11) 98888-7777",
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
  vi.mocked(sendNotification).mockClear();
  vi.mocked(deliverNotification).mockClear();
});

describe("agendamento pelo portal", () => {
  it("cria ficha, agendamento e histórico, e envia o link", async () => {
    const { db } = await getTestDatabase();
    const confirmation = await createPublicBooking(booking(), ctx);

    expect(confirmation).toMatchObject({ date: "2026-09-02", startTime: "10:00", endTime: "11:00" });
    await expect(findAppointmentByToken(confirmation.token)).resolves.toMatchObject({
      status: "scheduled",
      source: "portal",
      clientName: "Maria Silva",
    });
    expect((await getClientByPhone("11988887777"))?.tags).toEqual(["Portal"]);
    expect(await db.select().from(appointmentEvents)).toHaveLength(1);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "booking-requested", to: "11988887777" }),
    );
  });

  it("reaproveita a ficha cadastrada pela equipe sem expor o nome dela", async () => {
    const { db } = await getTestDatabase();
    const staffClient = await createClient({
      name: "Maria Aparecida Silva",
      phone: "11988887777",
      tags: [],
    });

    const confirmation = await createPublicBooking(booking({ firstName: "Mari" }), ctx);

    expect(await db.select().from(clients)).toHaveLength(1);
    const stored = await findAppointmentByToken(confirmation.token);
    expect(stored).toMatchObject({ clientId: staffClient.id, clientName: "Mari Silva" });
  });

  it("limita a três agendamentos ativos e libera a vaga ao cancelar", async () => {
    const first = await createPublicBooking(booking({ date: "2026-09-02" }), ctx);
    await createPublicBooking(booking({ date: "2026-09-03" }), ctx);
    await createPublicBooking(booking({ date: "2026-09-04" }), ctx);

    await expect(createPublicBooking(booking({ date: "2026-09-05" }), ctx)).rejects.toThrow(
      /limite de agendamentos futuros/,
    );

    await cancelPublicBooking(first.token);
    await expect(createPublicBooking(booking({ date: "2026-09-05" }), ctx)).resolves.toMatchObject(
      { date: "2026-09-05" },
    );
  });

  it("aplica o limite de tentativas por telefone", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        createPublicBooking(booking({ startTime: "07:00" }), { ip: `10.0.0.${attempt}` }),
      ).rejects.toThrow(/08:00/);
    }

    await expect(createPublicBooking(booking(), { ip: "10.0.1.1" })).rejects.toThrow(
      /Muitas tentativas/,
    );
  });

  it("lista só horários livres, respeitando o tempo de preparo", async () => {
    await createPublicBooking(booking({ serviceId: "srv-2", professionalId: "pro-2" }), ctx);

    const slots = await listAvailability({ serviceId: "srv-2", date: "2026-09-02" }, ctx);
    const times = slots.map((slot) => slot.startTime);

    expect(times).not.toContain("10:00");
    // Termina 11:00 + 15 min de preparo: o próximo horário da grade é 11:30.
    expect(times).not.toContain("11:00");
    expect(times).toContain("11:30");
    expect(new Set(slots.map((slot) => slot.professionalId))).toEqual(new Set(["pro-2"]));
  });

  it("não remarca para além da janela do portal e remarca dentro dela", async () => {
    const created = await createPublicBooking(booking(), ctx);
    const input = { token: created.token, professionalId: "pro-1", startTime: "10:00" };

    await expect(reschedulePublicBooking({ ...input, date: "2026-12-01" })).rejects.toThrow(
      /fora do período/,
    );
    await expect(reschedulePublicBooking({ ...input, date: "2026-09-03" })).resolves.toMatchObject({
      date: "2026-09-03",
      token: created.token,
    });
  });

  it("não oferece nem aceita profissional inativa", async () => {
    const { db } = await getTestDatabase();
    await db.update(professionals).set({ active: false }).where(eq(professionals.id, "pro-1"));

    const catalog = await getBookingCatalog();
    expect(catalog.services.map((service) => service.id)).toEqual(["srv-2"]);
    await expect(createPublicBooking(booking(), ctx)).rejects.toThrow(/Profissional indisponível/);
  });
});

describe("garantias do banco", () => {
  it("recusa sobreposição mesmo quando duas requisições validam ao mesmo tempo", async () => {
    const { db } = await getTestDatabase();
    await createPublicBooking(booking(), ctx);
    const otherClient = await seedClient();

    const error = await db
      .insert(appointments)
      .values({
        id: "apt-concorrente",
        date: "2026-09-02",
        startTime: "10:30",
        endTime: "11:30",
        clientId: otherClient,
        clientName: "Carla Souza",
        serviceId: "srv-1",
        serviceName: "Limpeza de pele",
        professionalId: "pro-1",
        professionalName: "Ana",
        priceCents: 15000,
        source: "portal",
      })
      .catch((caught: unknown) => caught);

    expect(toUserMessage(error).message).toMatch(/acabou de ser ocupado/);
  });

  it("desfaz todas as gravações quando uma parte da operação falha", async () => {
    const { db, atomic } = await getTestDatabase();
    await createPublicBooking(booking(), ctx);

    await expect(
      atomic([
        db.insert(clients).values({
          id: "cli-orfa",
          name: "Nova",
          phone: "(11) 96666-0000",
          phoneDigits: "11966660000",
        }),
        db.insert(appointments).values({
          id: "apt-conflito",
          date: "2026-09-02",
          startTime: "10:00",
          endTime: "11:00",
          clientId: "cli-orfa",
          clientName: "Nova",
          serviceId: "srv-1",
          serviceName: "Limpeza de pele",
          professionalId: "pro-1",
          professionalName: "Ana",
          priceCents: 15000,
          source: "portal",
        }),
      ]),
    ).rejects.toThrow();

    expect(await db.select().from(clients).where(eq(clients.id, "cli-orfa"))).toHaveLength(0);
  });

  it("traduz telefone duplicado em mensagem legível", async () => {
    await createClient({ name: "Ana Lima", phone: "(11) 95555-0000", tags: [] });
    const error = await createClient({ name: "Outra", phone: "11955550000", tags: [] }).catch(
      (caught: unknown) => caught,
    );
    expect(toUserMessage(error)).toMatchObject({
      message: "Já existe uma cliente cadastrada com esse telefone.",
      fieldErrors: { phone: expect.any(String) },
    });
  });
});

describe("recuperação e lembretes", () => {
  const phone = "(11) 98888-7777";

  it("recupera os links pelo telefone com código de uso único", async () => {
    const created = await createPublicBooking(booking(), ctx);
    await requestRecoveryCode({ phone }, ctx);

    const message = vi
      .mocked(sendNotification)
      .mock.calls.map(([sent]) => sent)
      .find((sent) => sent.kind === "recovery-code");
    const code = message?.text.match(/\d{6}/)?.[0] ?? "";
    const wrongCode = code === "000000" ? "111111" : "000000";

    await expect(verifyRecoveryCode({ phone, code: wrongCode })).rejects.toThrow(/Código inválido/);

    const recovered = await verifyRecoveryCode({ phone, code });
    expect(recovered).toEqual([
      expect.objectContaining({ path: `/meu-agendamento/${created.token}`, startTime: "10:00" }),
    ]);

    await expect(verifyRecoveryCode({ phone, code })).rejects.toThrow(/Código inválido/);
  });

  it("não revela se o telefone tem cadastro", async () => {
    await expect(requestRecoveryCode({ phone: "(11) 90000-0000" }, ctx)).resolves.toBeUndefined();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("envia um lembrete por agendamento na véspera", async () => {
    await createPublicBooking(booking({ date: "2026-09-02" }), ctx);
    await createPublicBooking(booking({ date: "2026-09-03", phone: "(11) 91111-2222" }), ctx);

    await expect(sendDueReminders()).resolves.toMatchObject({ sent: 1 });
    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "reminder", to: "11988887777" }),
    );
    await expect(sendDueReminders()).resolves.toMatchObject({ sent: 0 });
  });
});
