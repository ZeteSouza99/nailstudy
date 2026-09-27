import type {
  PaymentItem,
  PaymentMethodEntry,
  PaymentMethodKind,
  PaymentStatus,
} from "@/types/domain";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKind, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  transfer: "Transferência",
  other: "Outro",
};

export const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value: value as PaymentMethodKind, label }),
);

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: "Pago",
  refunded: "Estornado",
};

/** Aceita reais com vírgula ou ponto decimal; entradas inválidas seguem para a validação. */
export function parseMoneyInput(value: string) {
  const text = value.trim();
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return /^-?\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Arredonda para centavos, evitando frações herdadas do ponto flutuante. */
export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateCommission(price: number, ratePercent: number) {
  return roundMoney((price * ratePercent) / 100);
}

interface TotalsInput {
  items: ReadonlyArray<Pick<PaymentItem, "price" | "commission">>;
  discount?: number;
  surcharge?: number;
}

export function paymentTotals({ items, discount = 0, surcharge = 0 }: TotalsInput) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.price, 0));
  const commission = roundMoney(items.reduce((sum, item) => sum + item.commission, 0));
  const total = roundMoney(Math.max(0, subtotal - discount + surcharge));
  return { subtotal, total, commission };
}

export function sumMethods(methods: ReadonlyArray<Pick<PaymentMethodEntry, "amount">>) {
  return roundMoney(methods.reduce((sum, method) => sum + method.amount, 0));
}

/** Compara valores em reais tolerando frações de centavo. */
export function sameAmount(first: number, second: number) {
  return Math.abs(first - second) < 0.005;
}
