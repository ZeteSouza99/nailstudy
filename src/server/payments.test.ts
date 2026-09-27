import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { appointments, paymentItems, paymentMethods, payments, professionals } from "@/db/schema";
import { NOW, seedCatalog, seedClient, seedUsers } from "@/test/fixtures";
import { getTestDatabase, resetDatabase } from "@/test/test-db";
import type { AppointmentStatus, PaymentMethodKind } from "@/types/domain";

vi.mock("@/db", async () => {
  const { getTestDatabase: open } = await import("@/test/test-db");
  const { db, atomic } = await open();
  return { db, atomic };
});

vi.mock("@/components/payments/payments-view", () => ({ PaymentsView: () => null }));
vi.mock("@/server/session", () => ({ requirePageUser: vi.fn() }));
vi.mock("@/server/notifications", () => ({ sendNotification: vi.fn() }));

const { createPayment, deletePayment, refundPayment } = await import("./payment-service");
const { listBillableAppointments, listPayments } = await import("./payment-queries");
const { getFinancialReport } = await import("./report-queries");
const { changeAppointmentStatus } = await import("./appointment-service");
const { requirePageUser } = await import("./session");
const { default: PaymentsPage } = await import("@/app/(app)/pagamentos/page");

let people: Awaited<ReturnType<typeof seedUsers>>;

interface CompletedOptions {
  clientId?: string;
  status?: AppointmentStatus;
  serviceId?: string;
  serviceName?: string;
  professionalId?: string;
  professionalName?: string;
  priceCents?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
}

async function seedCompleted(id: string, options: CompletedOptions = {}) {
  const { db } = await getTestDatabase();
  await db.insert(appointments).values({
    id,
    date: options.date ?? "2026-09-01",
    startTime: options.startTime ?? "10:00",
    endTime: options.endTime ?? "11:00",
    clientId: options.clientId ?? "cli-1",
    clientName: "Carla Souza",
    serviceId: options.serviceId ?? "srv-1",
    serviceName: options.serviceName ?? "Limpeza de pele",
    professionalId: options.professionalId ?? "pro-1",
    professionalName: options.professionalName ?? "Ana",
    status: options.status ?? "completed",
    priceCents: options.priceCents ?? 15000,
    source: "staff",
  });
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
  vi.mocked(requirePageUser).mockResolvedValue(people.reception);
  const { db } = await getTestDatabase();
  // Ana ganha 40% de comissão; Bia fica sem comissão.
  await db.update(professionals).set({ commissionRateBps: 4000 }).where(eq(professionals.id, "pro-1"));
});

describe("pagamentos", () => {
  it.each(["2026-09-01", "2026-09-02", "2025-01-15"])(
    "disponibiliza no caixa o atendimento finalizado com data agendada %s",
    async (date) => {
      await seedCompleted("apt-finalizado", { date });
      const { db } = await getTestDatabase();
      await db.update(appointments).set({ status: "in-progress" }).where(eq(appointments.id, "apt-finalizado"));

      await changeAppointmentStatus({ id: "apt-finalizado", status: "completed" }, people.ana);

      // O período filtra recibos; não pode esconder pendências de cobrança.
      const page = await PaymentsPage({ searchParams: Promise.resolve({ de: "2026-08-01", ate: "2026-08-31" }) });
      expect(page.props.billable.map((item: { id: string }) => item.id)).toContain("apt-finalizado");
      expect(page.props.payments).toEqual([]);
    },
  );

  it.each(["scheduled", "confirmed", "in-progress", "cancelled"] as const)(
    "não lista nem cobra atendimento com status %s",
    async (status) => {
      await seedCompleted("apt-1", { status });
      expect(await listBillableAppointments()).toEqual([]);
      await expect(createPayment({
        appointmentIds: ["apt-1"], paidAt: "2026-09-01", discount: 0, surcharge: 0,
        methods: [{ method: "pix", amount: 150 }],
      }, people.reception)).rejects.toThrow(/concluídos/i);
    },
  );

  it("não mistura clientes no mesmo recibo nem grava parte da cobrança", async () => {
    await seedClient("cli-2", "11977770002", "Outra Cliente");
    await seedCompleted("apt-1");
    await seedCompleted("apt-2", { clientId: "cli-2", startTime: "11:00", endTime: "12:00" });
    await expect(createPayment({
      appointmentIds: ["apt-1", "apt-2"], paidAt: "2026-09-01", discount: 0, surcharge: 0,
      methods: [{ method: "pix", amount: 300 }],
    }, people.reception)).rejects.toThrow(/mesma cliente/i);
    expect(await listPayments("2026-09-01", "2026-09-30")).toEqual([]);
    expect(await listBillableAppointments()).toHaveLength(2);
  });

  it("rejeita atendimento inexistente e mantém os existentes a receber", async () => {
    await seedCompleted("apt-1");
    await expect(createPayment({
      appointmentIds: ["apt-1", "inexistente"], paidAt: "2026-09-01", discount: 0, surcharge: 0,
      methods: [{ method: "pix", amount: 150 }],
    }, people.reception)).rejects.toThrow(/não existe/i);
    expect(await listBillableAppointments()).toHaveLength(1);
  });

  it("remove IDs repetidos e mantém valores e comissões históricos", async () => {
    await seedCompleted("apt-1", { priceCents: 9990 });
    const payment = await createPayment({
      appointmentIds: ["apt-1", "apt-1"], paidAt: "2026-09-01", discount: 9.9, surcharge: 5.25,
      methods: [{ method: "credit", amount: 95.25 }],
    }, people.admin);
    expect(payment).toMatchObject({ subtotal: 99.9, total: 95.25 });
    expect(payment.items).toHaveLength(1);
    expect(payment.items[0].commission).toBe(39.96);

    const { db } = await getTestDatabase();
    await db.update(professionals).set({ commissionRateBps: 1000 }).where(eq(professionals.id, "pro-1"));
    const [stored] = await listPayments("2026-09-01", "2026-09-01");
    expect(stored.items[0]).toMatchObject({ price: 99.9, commissionRate: 40, commission: 39.96 });
    expect(await listPayments("2026-09-02", "2026-09-30")).toEqual([]);
  });

  it.each([150, 200])("rejeita desconto de %s que zera o recibo", async (discount) => {
    await seedCompleted("apt-1");
    await expect(createPayment({
      appointmentIds: ["apt-1"], paidAt: "2026-09-01", discount, surcharge: 0,
      methods: [{ method: "pix", amount: 150 }],
    }, people.reception)).rejects.toThrow(/maior que zero/i);
    expect(await listBillableAppointments()).toHaveLength(1);
  });

  it("reverte recibo e itens se a gravação das formas falhar", async () => {
    await seedCompleted("apt-1");
    // Simula uma falha do banco na última etapa, depois de gravar recibo e itens.
    await expect(createPayment({
      appointmentIds: ["apt-1"], paidAt: "2026-09-01", discount: 0, surcharge: 0,
      methods: [{ method: "invalido" as PaymentMethodKind, amount: 150 }],
    }, people.reception)).rejects.toThrow();
    const { db } = await getTestDatabase();
    expect(await db.select().from(payments)).toEqual([]);
    expect(await db.select().from(paymentItems)).toEqual([]);
    expect(await db.select().from(paymentMethods)).toEqual([]);
    expect(await listBillableAppointments()).toHaveLength(1);
  });

  it("remove recebimento e comissão dos relatórios ao estornar, sem permitir outro estorno", async () => {
    await seedCompleted("apt-1");
    const payment = await createPayment({
      appointmentIds: ["apt-1"], paidAt: "2026-09-01", discount: 0, surcharge: 0,
      methods: [{ method: "pix", amount: 150 }],
    }, people.reception);
    await refundPayment(payment.id);
    await expect(refundPayment(payment.id)).rejects.toThrow(/já estornado/i);
    const report = await getFinancialReport("2026-09-01", "2026-09-30");
    expect(report.summary).toMatchObject({ received: 0, refunded: 150, commission: 0, paymentsCount: 0 });
    expect(report.byMethod).toEqual([]);
    expect(report.byProfessional).toEqual([]);
    await deletePayment(payment.id);
    await expect(deletePayment(payment.id)).rejects.toThrow(/não encontrado/i);
  });

  it("registra um recibo unificado com comissão e formas divididas", async () => {
    await seedCompleted("apt-1", { priceCents: 15000 });
    await seedCompleted("apt-2", {
      serviceId: "srv-2",
      serviceName: "Drenagem",
      professionalId: "pro-2",
      professionalName: "Bia",
      priceCents: 18000,
      startTime: "11:00",
      endTime: "12:00",
    });

    const payment = await createPayment(
      {
        appointmentIds: ["apt-1", "apt-2"],
        paidAt: "2026-09-01",
        discount: 0,
        surcharge: 0,
        methods: [
          { method: "pix", amount: 200 },
          { method: "cash", amount: 130 },
        ],
      },
      people.reception,
    );

    expect(payment.subtotal).toBe(330);
    expect(payment.total).toBe(330);
    expect(payment.items.reduce((sum, item) => sum + item.commission, 0)).toBe(60);
    expect(payment.methods).toHaveLength(2);

    const { db } = await getTestDatabase();
    expect(await db.select().from(paymentItems)).toHaveLength(2);
  });

  it("aplica desconto ao total", async () => {
    await seedCompleted("apt-1", { priceCents: 15000 });
    const payment = await createPayment(
      {
        appointmentIds: ["apt-1"],
        paidAt: "2026-09-01",
        discount: 20,
        surcharge: 0,
        methods: [{ method: "pix", amount: 130 }],
      },
      people.reception,
    );
    expect(payment.total).toBe(130);
  });

  it("recusa quando as formas não somam o total", async () => {
    await seedCompleted("apt-1", { priceCents: 15000 });
    await expect(
      createPayment(
        {
          appointmentIds: ["apt-1"],
          paidAt: "2026-09-01",
          discount: 0,
          surcharge: 0,
          methods: [{ method: "pix", amount: 100 }],
        },
        people.reception,
      ),
    ).rejects.toThrow(/formas de pagamento/i);
  });

  it("não cobra o mesmo atendimento duas vezes", async () => {
    await seedCompleted("apt-1", { priceCents: 15000 });
    const input = {
      appointmentIds: ["apt-1"],
      paidAt: "2026-09-01",
      discount: 0,
      surcharge: 0,
      methods: [{ method: "pix" as const, amount: 150 }],
    };
    await createPayment(input, people.reception);
    await expect(createPayment(input, people.reception)).rejects.toThrow(/já tem pagamento/i);
  });

  it("só aceita atendimentos concluídos", async () => {
    const { db } = await getTestDatabase();
    await db.insert(appointments).values({
      id: "apt-x",
      date: "2026-09-02",
      startTime: "10:00",
      endTime: "11:00",
      clientId: "cli-1",
      clientName: "Carla Souza",
      serviceId: "srv-1",
      serviceName: "Limpeza de pele",
      professionalId: "pro-1",
      professionalName: "Ana",
      status: "scheduled",
      priceCents: 15000,
      source: "staff",
    });

    await expect(
      createPayment(
        {
          appointmentIds: ["apt-x"],
          paidAt: "2026-09-01",
          discount: 0,
          surcharge: 0,
          methods: [{ method: "pix", amount: 150 }],
        },
        people.reception,
      ),
    ).rejects.toThrow(/concluídos/i);
  });

  it("lista atendimentos a receber e remove os já pagos", async () => {
    await seedCompleted("apt-1", { priceCents: 15000 });
    await seedCompleted("apt-2", { priceCents: 18000, startTime: "11:00", endTime: "12:00" });

    expect(await listBillableAppointments()).toHaveLength(2);

    await createPayment(
      {
        appointmentIds: ["apt-1"],
        paidAt: "2026-09-01",
        discount: 0,
        surcharge: 0,
        methods: [{ method: "pix", amount: 150 }],
      },
      people.reception,
    );

    const remaining = await listBillableAppointments();
    expect(remaining.map((item) => item.id)).toEqual(["apt-2"]);
    expect(remaining[0].commissionRate).toBe(40);
  });

  it("estorna e depois exclui, liberando o atendimento", async () => {
    await seedCompleted("apt-1", { priceCents: 15000 });
    const payment = await createPayment(
      {
        appointmentIds: ["apt-1"],
        paidAt: "2026-09-01",
        discount: 0,
        surcharge: 0,
        methods: [{ method: "pix", amount: 150 }],
      },
      people.reception,
    );

    await refundPayment(payment.id);
    const afterRefund = await listPayments("2026-09-01", "2026-09-30");
    expect(afterRefund[0].status).toBe("refunded");
    expect(await listBillableAppointments()).toHaveLength(0);

    await deletePayment(payment.id);
    expect(await listPayments("2026-09-01", "2026-09-30")).toHaveLength(0);
    expect(await listBillableAppointments()).toHaveLength(1);
  });

  it("agrega o relatório financeiro do período", async () => {
    await seedCompleted("apt-1", { priceCents: 15000 });
    await seedCompleted("apt-2", {
      serviceId: "srv-2",
      serviceName: "Drenagem",
      professionalId: "pro-2",
      professionalName: "Bia",
      priceCents: 18000,
      startTime: "11:00",
      endTime: "12:00",
    });

    await createPayment(
      {
        appointmentIds: ["apt-1", "apt-2"],
        paidAt: "2026-09-01",
        discount: 0,
        surcharge: 0,
        methods: [
          { method: "pix", amount: 200 },
          { method: "cash", amount: 130 },
        ],
      },
      people.reception,
    );

    const report = await getFinancialReport("2026-09-01", "2026-09-30");
    expect(report.summary.received).toBe(330);
    expect(report.summary.paymentsCount).toBe(1);
    expect(report.summary.commission).toBe(60);
    expect(report.summary.completedCount).toBe(2);
    expect(report.byMethod.find((row) => row.method === "pix")?.amount).toBe(200);
    expect(report.byProfessional.find((row) => row.professionalId === "pro-1")?.commission).toBe(60);
    expect(report.byService).toHaveLength(2);
  });
});
