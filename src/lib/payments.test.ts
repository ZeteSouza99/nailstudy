import { describe, expect, it } from "vitest";

import { calculateCommission, parseMoneyInput, paymentTotals, sameAmount, sumMethods } from "./payments";

describe("pagamentos", () => {
  it.each([
    ["219.50", 219.5], ["219,50", 219.5], ["1.234,56", 1234.56],
    [" 150 ", 150], ["", 0], ["-10", -10],
  ])("interpreta o valor %s como %s reais", (input, expected) => {
    expect(parseMoneyInput(input as string)).toBe(expected);
  });

  it.each(["abc", "100,001", "1,2,3", "Infinity", "12.3.4"])("não transforma %s em zero ou outro valor", (input) => {
    expect(parseMoneyInput(input)).toBeNaN();
  });
  it("calcula a comissão arredondada a centavos", () => {
    expect(calculateCommission(150, 40)).toBe(60);
    expect(calculateCommission(99.9, 30)).toBe(29.97);
    expect(calculateCommission(100, 0)).toBe(0);
  });

  it("soma o subtotal e aplica desconto e acréscimo", () => {
    const items = [
      { price: 150, commission: 60 },
      { price: 80, commission: 0 },
    ];
    expect(paymentTotals({ items })).toEqual({ subtotal: 230, total: 230, commission: 60 });
    expect(paymentTotals({ items, discount: 30 }).total).toBe(200);
    expect(paymentTotals({ items, surcharge: 20 }).total).toBe(250);
  });

  it("não deixa o total ficar negativo", () => {
    expect(paymentTotals({ items: [{ price: 100, commission: 0 }], discount: 300 }).total).toBe(0);
  });

  it("soma as formas de pagamento", () => {
    expect(sumMethods([{ amount: 60 }, { amount: 40 }])).toBe(100);
    expect(sumMethods([])).toBe(0);
  });

  it("compara valores tolerando frações de centavo", () => {
    expect(sameAmount(100, 100.004)).toBe(true);
    expect(sameAmount(100, 100.01)).toBe(false);
  });
});
