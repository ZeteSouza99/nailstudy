import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { NOW } from "@/test/fixtures";

import { paymentSchema } from "./validation";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterAll(() => vi.useRealTimers());

const valid = {
  appointmentIds: ["apt-1"],
  paidAt: "2026-09-01",
  discount: 0,
  surcharge: 0,
  methods: [{ method: "pix", amount: 150 }],
};

describe("validação do caixa", () => {
  it.each(["pix", "cash", "credit", "debit", "transfer", "other"])("aceita a forma %s", (method) => {
    const parsed = paymentSchema.parse({ ...valid, methods: [{ method, amount: 150 }] });
    expect(paymentSchema.parse(parsed)).toEqual(parsed);
  });

  it.each([
    { appointmentIds: [] },
    { methods: [] },
    { methods: [{ method: "invalido", amount: 150 }] },
    { methods: [{ method: "pix", amount: 0 }] },
    { methods: [{ method: "pix", amount: -1 }] },
    { methods: [{ method: "pix", amount: Number.NaN }] },
    { discount: -1 },
    { surcharge: -1 },
    { paidAt: "2026-09-02" },
  ])("rejeita entrada inválida %j", (changes) => {
    expect(paymentSchema.safeParse({ ...valid, ...changes }).success).toBe(false);
  });
});
