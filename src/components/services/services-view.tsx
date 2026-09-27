"use client";

import {
  Clock3,
  Grid2X2,
  List,
  Plus,
  Scissors,
  Sparkles,
  Tag,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatCurrency, formatDuration, normalizeText } from "@/lib/formatters";
import type { Service, ServiceStatus } from "@/types/domain";

import { ServiceForm } from "./service-form";

type ServiceViewMode = "grid" | "list";
type ServiceStatusFilter = "all" | ServiceStatus;

export function ServicesView({ services, canManage }: { services: Service[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<ServiceStatusFilter>("all");
  const [view, setView] = useState<ServiceViewMode>("grid");
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [feedback, setFeedback] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(services.map((service) => service.category))).sort(),
    [services],
  );

  const filteredServices = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return services.filter((service) => {
      const searchable = normalizeText(`${service.name} ${service.category} ${service.description}`);
      return (
        searchable.includes(normalizedQuery) &&
        (category === "all" || service.category === category) &&
        (status === "all" || service.status === status)
      );
    });
  }, [category, query, services, status]);

  const activeServices = services.filter((service) => service.status === "active");
  const averagePrice = activeServices.length
    ? activeServices.reduce((sum, service) => sum + service.price, 0) / activeServices.length
    : 0;
  const open = canManage ? (service: Service) => setEditing(service) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catálogo"
        title="Serviços"
        description="Gerencie procedimentos, duração, preparo, valores e disponibilidade no agendamento."
        actions={
          canManage ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Novo serviço
            </Button>
          ) : null
        }
      />

      {feedback ? (
        <Alert tone="success" onDismiss={() => setFeedback("")}>
          {feedback}
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo de serviços">
        {[
          {
            label: "Serviços ativos",
            value: activeServices.length,
            detail: `${services.length - activeServices.length} inativo(s)`,
            icon: Scissors,
          },
          { label: "Categorias", value: categories.length, detail: "Protocolos organizados", icon: Tag },
          { label: "Ticket médio", value: formatCurrency(averagePrice), detail: "Entre serviços ativos", icon: WalletCards },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="surface-card flex items-center gap-4 p-4 sm:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xl font-extrabold text-slate-950 dark:text-slate-50">{item.value}</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="surface-card p-3 sm:p-4" aria-label="Filtros dos serviços">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <SearchInput
            className="w-full xl:max-w-sm"
            placeholder="Buscar serviço ou categoria..."
            aria-label="Buscar serviços"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
          />
          <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:items-center">
            <label className="sr-only" htmlFor="service-category-filter">
              Filtrar por categoria
            </label>
            <select id="service-category-filter" className="form-control xl:w-48" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Todas as categorias</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="service-status-filter">
              Filtrar por status
            </label>
            <select id="service-status-filter" className="form-control xl:w-40" value={status} onChange={(event) => setStatus(event.target.value as ServiceStatusFilter)}>
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1 xl:ml-auto" role="group" aria-label="Modo de exibição">
            {(
              [
                ["grid", "Cards", Grid2X2],
                ["list", "Lista", List],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                aria-pressed={view === value}
                className={cn(
                  "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:flex-none",
                  view === value ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm" : "text-slate-500 dark:text-slate-400",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filteredServices.length ? (
        view === "grid" ? (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Cards de serviços">
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} onOpen={open} />
            ))}
          </section>
        ) : (
          <section className="surface-card overflow-hidden" aria-label="Tabela de serviços">
            <div className="overflow-x-auto">
              <table className="w-full min-w-200 text-left">
                <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Serviço</th>
                    <th className="px-5 py-3">Categoria</th>
                    <th className="px-5 py-3">Duração</th>
                    <th className="px-5 py-3">Preço</th>
                    <th className="px-5 py-3">Status</th>
                    {canManage ? <th className="px-5 py-3"><span className="sr-only">Ações</span></th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: service.color }}>
                            <Sparkles className="size-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{service.name}</p>
                            <p className="mt-0.5 max-w-sm truncate text-xs text-slate-600 dark:text-slate-300">{service.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">{service.category}</td>
                      <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
                        {formatDuration(service.durationMinutes)}
                        {service.bufferMinutes ? ` + ${service.bufferMinutes} min` : ""}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-slate-50">{formatCurrency(service.price)}</td>
                      <td className="px-5 py-4"><StatusBadge kind="service" status={service.status} /></td>
                      {canManage ? (
                        <td className="px-5 py-4 text-right">
                          <Button size="sm" variant="secondary" onClick={() => setEditing(service)}>
                            Editar
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : (
        <section className="surface-card">
          <EmptyState title="Nenhum serviço encontrado" description="Revise os termos da busca ou selecione outros filtros." />
        </section>
      )}

      <p className="text-center text-xs text-slate-600 dark:text-slate-300">
        Exibindo {filteredServices.length} de {services.length} serviços
      </p>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Novo serviço" : "Editar serviço"}
      >
        {editing ? (
          <ServiceForm
            key={editing === "new" ? "new" : editing.id}
            service={editing === "new" ? undefined : editing}
            categories={categories}
            onCancel={() => setEditing(null)}
            onDone={(message) => {
              setEditing(null);
              setFeedback(message);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function ServiceCard({ service, onOpen }: { service: Service; onOpen?: (service: Service) => void }) {
  const body = (
    <>
      <span className="block h-1.5" style={{ backgroundColor: service.color }} />
      <span className="block p-5">
        <span className="flex items-start justify-between gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: service.color }}>
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <StatusBadge kind="service" status={service.status} />
        </span>
        <span className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: `color-mix(in srgb, ${service.color} 70%, var(--foreground))` }}>
          {service.category}
        </span>
        <span className="mt-1 block font-bold text-slate-950 dark:text-slate-50">{service.name}</span>
        <span className="mt-2 block min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">{service.description}</span>
        <span className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Clock3 className="size-4 text-slate-400" aria-hidden="true" />
            {formatDuration(service.durationMinutes)}
            {service.bufferMinutes ? ` + ${service.bufferMinutes} min de preparo` : ""}
          </span>
          <span className="text-lg font-extrabold text-slate-950 dark:text-slate-50">{formatCurrency(service.price)}</span>
        </span>
      </span>
    </>
  );

  const className = "surface-card group block w-full overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-md";

  return onOpen ? (
    <button
      type="button"
      onClick={() => onOpen(service)}
      className={cn(className, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600")}
      aria-label={`Editar ${service.name}`}
    >
      {body}
    </button>
  ) : (
    <article className={className}>{body}</article>
  );
}
