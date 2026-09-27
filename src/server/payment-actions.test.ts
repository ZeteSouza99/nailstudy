import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { appointments } from "@/db/schema";
import { NOW, seedCatalog, seedClient, seedUsers } from "@/test/fixtures";
import { getTestDatabase, resetDatabase } from "@/test/test-db";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth", () => ({
  auth: async () => session.userId ? { user: { id: session.userId } } : null,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", async () => {
  const { getTestDatabase: open } = await import("@/test/test-db");
  const { db, atomic } = await open();
  return { db, atomic };
});

const { createPaymentAction, deletePaymentAction, refundPaymentAction, listBillableAppointmentsAction } = await import("@/app/actions");
const { listPayments } = await import("./payment-queries");

const input = {
  appointmentIds: ["apt-1"], paidAt: "2026-09-01", discount: 0, surcharge: 0,
  methods: [{ method: "pix", amount: 150 }],
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());
beforeEach(async () => {
  await resetDatabase();
  await seedCatalog();
  await seedClient();
  await seedUsers();
  session.userId = null;
  const { db } = await getTestDatabase();
  await db.insert(appointments).values({
    id: "apt-1", date: "2026-09-02", startTime: "10:00", endTime: "11:00",
    clientId: "cli-1", clientName: "Carla Souza", serviceId: "srv-1", serviceName: "Limpeza de pele",
    professionalId: "pro-1", professionalName: "Ana", status: "completed", priceCents: 15000,
  });
});

describe("ações do caixa", () => {
  it.each([null, "usuario-removido"])("bloqueia leitura e alterações para sessão %s", async (userId) => {
    session.userId = userId;
    const results = [
      await listBillableAppointmentsAction(),
      await createPaymentAction(input),
      await refundPaymentAction("pay-1"),
      await deletePaymentAction("pay-1"),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Sessão expirada/);
    }
    expect(await listPayments("2026-09-01", "2026-09-30")).toEqual([]);
  });

  it("permite à administradora consultar, cobrar, estornar e excluir", async () => {
    session.userId = "usr-admin";
    const available = await listBillableAppointmentsAction();
    expect(available.ok && available.data.map((item) => item.id)).toEqual(["apt-1"]);
    const result = await createPaymentAction(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(await listBillableAppointmentsAction()).toEqual({ ok: true, data: [] });
    expect(await createPaymentAction(input)).toMatchObject({ ok: false, error: expect.stringMatching(/já tem pagamento/) });
    expect(await refundPaymentAction(result.data.id)).toEqual({ ok: true, data: null });
    expect(await deletePaymentAction(result.data.id)).toEqual({ ok: true, data: null });
    const reopened = await listBillableAppointmentsAction();
    expect(reopened.ok && reopened.data.map((item) => item.id)).toEqual(["apt-1"]);
  });

  it("retorna erro por campo e não grava recibo com dados inválidos", async () => {
    session.userId = "usr-admin";
    expect(await createPaymentAction({ ...input, paidAt: "2026-09-02" })).toMatchObject({
      ok: false, fieldErrors: { paidAt: expect.any(String) },
    });
    expect(await createPaymentAction({ ...input, methods: [{ method: "pix", amount: -1 }] })).toMatchObject({ ok: false });
    expect(await listPayments("2026-09-01", "2026-09-30")).toEqual([]);
  });
});
