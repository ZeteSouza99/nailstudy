"use client";

import { Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createPaymentAction, listBillableAppointmentsAction } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fieldA11y, FormField } from "@/components/ui/form-field";
import type { ActionResult } from "@/lib/action-result";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  PAYMENT_METHODS,
  parseMoneyInput,
  roundMoney,
  sameAmount,
  sumMethods,
} from "@/lib/payments";
import { firstIssueMessage, paymentSchema } from "@/lib/validation";
import type { BillableAppointment, PaymentMethodKind } from "@/types/domain";

interface PaymentFormProps {
  today: string;
  onCancel: () => void;
  onDone: (message: string) => void;
}

interface MethodRow {
  method: PaymentMethodKind;
  amount: string;
}

function moneyToInput(value: number) {
  return value ? value.toFixed(2).replace(".", ",") : "";
}

/** Reconsulta ao abrir: outra pessoa pode ter concluído ou cobrado um atendimento. */
export function PaymentForm(props: PaymentFormProps) {
  const [result, setResult] = useState<ActionResult<BillableAppointment[]> | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    listBillableAppointmentsAction()
      .then((response) => {
        if (active) setResult(response);
      })
      .catch(() => {
        if (active) {
          setResult({ ok: false, error: "Não foi possível carregar os atendimentos. Tente novamente." });
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (!result) {
    return (
      <p role="status" className="p-6 text-sm text-slate-600 dark:text-slate-300">
        Carregando atendimentos a cobrar...
      </p>
    );
  }
  if (!result.ok) {
    return (
      <div className="space-y-4 p-6">
        <Alert>{result.error}</Alert>
        <Button
          variant="secondary"
          onClick={() => {
            setResult(null);
            setAttempt((value) => value + 1);
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }
  return <PaymentFields {...props} billable={result.data} />;
}

function PaymentFields({
  billable, today, onCancel, onDone,
}: PaymentFormProps & { billable: BillableAppointment[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [methods, setMethods] = useState<MethodRow[]>([{ method: "pix", amount: "" }]);
  const [discount, setDiscount] = useState("");
  const [surcharge, setSurcharge] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const clientGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; items: BillableAppointment[] }>();
    for (const item of billable) {
      const group = map.get(item.clientId) ?? { id: item.clientId, name: item.clientName, items: [] };
      group.items.push(item);
      map.set(item.clientId, group);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [billable]);

  const selectedItems = billable.filter((item) => selected.has(item.id));
  const selectedClientId = selectedItems[0]?.clientId ?? null;
  const subtotal = roundMoney(selectedItems.reduce((sum, item) => sum + item.price, 0));
  const total = roundMoney(
    Math.max(0, subtotal - (parseMoneyInput(discount) || 0) + (parseMoneyInput(surcharge) || 0)),
  );
  const methodsTotal = sumMethods(methods.map((row) => ({ amount: parseMoneyInput(row.amount) || 0 })));
  const remaining = roundMoney(total - methodsTotal);

  function toggle(item: BillableAppointment) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function fillRow(index: number) {
    const others = methods.reduce(
      (sum, row, position) => (position === index ? sum : sum + (parseMoneyInput(row.amount) || 0)),
      0,
    );
    const value = roundMoney(Math.max(0, total - others));
    setMethods((current) =>
      current.map((row, position) =>
        position === index ? { ...row, amount: moneyToInput(value) } : row,
      ),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const input = {
      appointmentIds: [...selected],
      paidAt,
      discount: parseMoneyInput(discount),
      surcharge: parseMoneyInput(surcharge),
      methods: methods.map((row) => ({ method: row.method, amount: parseMoneyInput(row.amount) })),
      notes: notes.trim() || undefined,
    };

    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }
    if (!sameAmount(sumMethods(input.methods), total)) {
      setError("A soma das formas de pagamento precisa bater com o total.");
      return;
    }

    startTransition(async () => {
      const result = await createPaymentAction(parsed.data);
      if (result.ok) onDone(`Pagamento de ${result.data.clientName} registrado.`);
      else setError(result.error);
    });
  }

  if (!billable.length) {
    return (
      <div className="space-y-4 p-5 text-center sm:p-6">
        <Receipt className="mx-auto size-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Nenhum atendimento concluído aguardando pagamento. Conclua um atendimento na agenda para
          registrar o recibo.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6" noValidate>
      {error ? <Alert>{error}</Alert> : null}

      <div>
        <p className="form-label">Atendimentos a cobrar</p>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Selecione um ou mais atendimentos concluídos de uma mesma cliente.
        </p>
        <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          {clientGroups.map((group) => {
            const disabled = selectedClientId !== null && selectedClientId !== group.id;
            return (
              <div key={group.id} className={disabled ? "opacity-40" : undefined}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {group.name}
                </p>
                <div className="mt-1 space-y-1">
                  {group.items.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-950"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-teal-700"
                        checked={selected.has(item.id)}
                        disabled={disabled}
                        onChange={() => toggle(item)}
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                        {formatDate(item.date)} · {item.serviceName} · {item.professionalName}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-50">
                        {formatCurrency(item.price)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FormField id="payment-date" label="Data">
          <input
            {...fieldA11y("payment-date")}
            type="date"
            className="form-control"
            max={today}
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
          />
        </FormField>
        <FormField id="payment-discount" label="Desconto (R$)" optional>
          <input
            {...fieldA11y("payment-discount")}
            inputMode="decimal"
            className="form-control"
            placeholder="0,00"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </FormField>
        <FormField id="payment-surcharge" label="Acréscimo (R$)" optional>
          <input
            {...fieldA11y("payment-surcharge")}
            inputMode="decimal"
            className="form-control"
            placeholder="0,00"
            value={surcharge}
            onChange={(event) => setSurcharge(event.target.value)}
          />
        </FormField>
      </div>

      <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3">
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-base font-bold text-slate-950 dark:text-slate-50">
          <span>Total a pagar</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="form-label">Formas de pagamento</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setMethods((current) => [...current, { method: "pix", amount: "" }])}
          >
            <Plus className="size-4" aria-hidden="true" />
            Dividir
          </Button>
        </div>
        <div className="space-y-2">
          {methods.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                className="form-control w-40"
                value={row.method}
                aria-label="Forma de pagamento"
                onChange={(event) =>
                  setMethods((current) =>
                    current.map((entry, position) =>
                      position === index
                        ? { ...entry, method: event.target.value as PaymentMethodKind }
                        : entry,
                    ),
                  )
                }
              >
                {PAYMENT_METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                inputMode="decimal"
                className="form-control flex-1"
                placeholder="0,00"
                aria-label="Valor"
                value={row.amount}
                onChange={(event) =>
                  setMethods((current) =>
                    current.map((entry, position) =>
                      position === index ? { ...entry, amount: event.target.value } : entry,
                    ),
                  )
                }
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => fillRow(index)}>
                = restante
              </Button>
              {methods.length > 1 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Remover forma"
                  onClick={() =>
                    setMethods((current) => current.filter((_, position) => position !== index))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        <p
          className={`mt-2 text-xs font-medium ${
            sameAmount(remaining, 0) ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
          }`}
        >
          {sameAmount(remaining, 0)
            ? "As formas somam exatamente o total."
            : remaining > 0
              ? `Faltam ${formatCurrency(remaining)} para fechar o total.`
              : `As formas passaram ${formatCurrency(Math.abs(remaining))} do total.`}
        </p>
      </div>

      <FormField id="payment-notes" label="Observações" optional>
        <textarea
          {...fieldA11y("payment-notes")}
          rows={2}
          maxLength={300}
          className="form-control h-auto resize-none py-2"
          placeholder="Ex.: cliente pagou parte no cartão da amiga."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </FormField>

      <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isPending} disabled={!selectedItems.length}>
          {isPending ? null : <Wallet className="size-4" aria-hidden="true" />}
          Registrar pagamento
        </Button>
      </div>
    </form>
  );
}
