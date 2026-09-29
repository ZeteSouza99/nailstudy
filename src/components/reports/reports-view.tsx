"use client";

import {
  BarChart3,
  CircleDollarSign,
  Download,
  HandCoins,
  Receipt,
  TrendingUp,
} from "lucide-react";

import { PeriodFilter } from "@/components/finance/period-filter";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments";
import type { FinancialReport } from "@/server/report-queries";

const money = (value: number) => value.toFixed(2).replace(".", ",");

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const content = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell);
          return /["\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(";"),
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ReportsView({ report }: { report: FinancialReport }) {
  const { range, summary, byProfessional, byService, byMethod, byDay } = report;
  const suffix = `${range.from}_a_${range.to}`;
  const maxDay = Math.max(1, ...byDay.map((day) => day.revenue));

  const stats = [
    {
      label: "Recebido",
      value: formatCurrency(summary.received, true),
      detail: `${summary.paymentsCount} recibo(s)`,
      icon: CircleDollarSign,
    },
    {
      label: "Ticket médio",
      value: formatCurrency(summary.averageTicket, true),
      detail: "por recibo",
      icon: TrendingUp,
    },
    {
      label: "Comissões",
      value: formatCurrency(summary.commission, true),
      detail: "a repassar",
      icon: HandCoins,
    },
    {
      label: "Atendimentos",
      value: String(summary.completedCount),
      detail: `${summary.cancelledCount} cancelado(s)`,
      icon: Receipt,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Relatórios"
        description="Faturamento, comissões, formas de pagamento e ocupação da agenda de Erika no período."
      />

      <PeriodFilter from={range.from} to={range.to} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do período">
        {stats.map((stat) => (
          <article key={stat.label} className="surface-card flex items-center gap-3 p-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300">
              <stat.icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-ink-950 dark:text-ink-50">{stat.value}</p>
              <p className="text-sm font-medium text-ink-600 dark:text-ink-300">{stat.label}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">{stat.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="surface-card grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-500 dark:text-ink-400">Descontos</p>
          <p className="font-semibold text-ink-900 dark:text-ink-50">{formatCurrency(summary.discounts)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 dark:text-ink-400">Acréscimos</p>
          <p className="font-semibold text-ink-900 dark:text-ink-50">{formatCurrency(summary.surcharges)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 dark:text-ink-400">Estornado</p>
          <p className="font-semibold text-ink-900 dark:text-ink-50">{formatCurrency(summary.refunded)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500 dark:text-ink-400">Líquido p/ estúdio</p>
          <p className="font-semibold text-ink-900 dark:text-ink-50">
            {formatCurrency(summary.received - summary.commission)}
          </p>
        </div>
      </section>

      <ReportSection
        title="Atendimentos de Erika"
        icon={BarChart3}
        empty={!byProfessional.length}
        onExport={() =>
          downloadCsv(`profissionais_${suffix}.csv`, [
            ["Profissional", "Atendimentos", "Receita", "Comissão", "Líquido", "Ocupação (%)"],
            ...byProfessional.map((row) => [
              row.professionalName,
              row.itemsCount,
              money(row.revenue),
              money(row.commission),
              money(row.net),
              row.occupancy,
            ]),
          ])
        }
      >
        <table role="table" className="responsive-table w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Profissional</th>
              <th className="px-4 py-2 text-right font-semibold">Atend.</th>
              <th className="px-4 py-2 text-right font-semibold">Receita</th>
              <th className="px-4 py-2 text-right font-semibold">Comissão</th>
              <th className="px-4 py-2 text-right font-semibold">Ocupação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {byProfessional.map((row) => (
              <tr key={row.professionalId}>
                <td data-label="Profissional" className="px-4 py-2 font-medium text-ink-900 dark:text-ink-50">{row.professionalName}</td>
                <td data-label="Atendimentos" className="px-4 py-2 text-right text-ink-600 dark:text-ink-300">{row.itemsCount}</td>
                <td data-label="Receita" className="px-4 py-2 text-right font-semibold text-ink-900 dark:text-ink-50">
                  {formatCurrency(row.revenue)}
                </td>
                <td data-label="Comissão" className="px-4 py-2 text-right text-ink-600 dark:text-ink-300">
                  {formatCurrency(row.commission)}
                </td>
                <td data-label="Ocupação" className="px-4 py-2 text-right text-ink-600 dark:text-ink-300">{row.occupancy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection
        title="Por serviço"
        icon={BarChart3}
        empty={!byService.length}
        onExport={() =>
          downloadCsv(`servicos_${suffix}.csv`, [
            ["Serviço", "Quantidade", "Receita"],
            ...byService.map((row) => [row.serviceName, row.quantity, money(row.revenue)]),
          ])
        }
      >
        <table role="table" className="responsive-table w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Serviço</th>
              <th className="px-4 py-2 text-right font-semibold">Qtd.</th>
              <th className="px-4 py-2 text-right font-semibold">Receita</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {byService.map((row) => (
              <tr key={row.serviceId}>
                <td data-label="Serviço" className="px-4 py-2 font-medium text-ink-900 dark:text-ink-50">{row.serviceName}</td>
                <td data-label="Quantidade" className="px-4 py-2 text-right text-ink-600 dark:text-ink-300">{row.quantity}</td>
                <td data-label="Receita" className="px-4 py-2 text-right font-semibold text-ink-900 dark:text-ink-50">
                  {formatCurrency(row.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection
        title="Por forma de pagamento"
        icon={BarChart3}
        empty={!byMethod.length}
        onExport={() =>
          downloadCsv(`formas_pagamento_${suffix}.csv`, [
            ["Forma", "Lançamentos", "Total"],
            ...byMethod.map((row) => [PAYMENT_METHOD_LABELS[row.method], row.count, money(row.amount)]),
          ])
        }
      >
        <table role="table" className="responsive-table w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Forma</th>
              <th className="px-4 py-2 text-right font-semibold">Lançamentos</th>
              <th className="px-4 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {byMethod.map((row) => (
              <tr key={row.method}>
                <td data-label="Forma" className="px-4 py-2 font-medium text-ink-900 dark:text-ink-50">
                  {PAYMENT_METHOD_LABELS[row.method]}
                </td>
                <td data-label="Lançamentos" className="px-4 py-2 text-right text-ink-600 dark:text-ink-300">{row.count}</td>
                <td data-label="Total" className="px-4 py-2 text-right font-semibold text-ink-900 dark:text-ink-50">
                  {formatCurrency(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportSection>

      <ReportSection
        title="Receita por dia"
        icon={BarChart3}
        empty={!byDay.length}
        onExport={() =>
          downloadCsv(`receita_por_dia_${suffix}.csv`, [
            ["Data", "Receita"],
            ...byDay.map((row) => [row.date, money(row.revenue)]),
          ])
        }
      >
        <ul className="space-y-2 p-4">
          {byDay.map((row) => (
            <li key={row.date} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 text-xs sm:w-24 sm:text-sm text-ink-600 dark:text-ink-300">
                {formatDate(row.date, { day: "2-digit", month: "short" })}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <span
                  className="block h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.round((row.revenue / maxDay) * 100)}%` }}
                />
              </span>
              <span className="shrink-0 text-right sm:w-24 font-semibold text-ink-900 dark:text-ink-50">
                {formatCurrency(row.revenue)}
              </span>
            </li>
          ))}
        </ul>
      </ReportSection>
    </div>
  );
}

interface ReportSectionProps {
  title: string;
  icon: typeof BarChart3;
  empty: boolean;
  onExport: () => void;
  children: React.ReactNode;
}

function ReportSection({ title, icon: Icon, empty, onExport, children }: ReportSectionProps) {
  return (
    <section className="surface-card overflow-hidden" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 dark:border-ink-800 px-4 py-3">
        <h2 className="flex min-w-0 items-center gap-2 font-semibold text-ink-900 dark:text-ink-50">
          <Icon className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
          {title}
        </h2>
        {!empty ? (
          <Button size="sm" variant="ghost" onClick={onExport}>
            <Download className="size-4" aria-hidden="true" />
            CSV
          </Button>
        ) : null}
      </div>
      {empty ? (
        <EmptyState title="Sem dados no período" description="Nenhum pagamento registrado aqui ainda." />
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </section>
  );
}
