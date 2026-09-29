"use client";

import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { cn, formatDate } from "@/lib/formatters";
import type { ClientSegment, ClientStats } from "@/server/queries";
import type { ClientSummary } from "@/types/domain";

import { ClientForm } from "./client-form";

const clientColors = ["#83423e", "#7c3aed", "#2563eb", "#d97706", "#db2777"];

function colorFor(id: string) {
  const hash = id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  return clientColors[hash % clientColors.length];
}

function buildUrl(
  pathname: string,
  { q, segmento, pagina }: { q: string; segmento: ClientSegment; pagina: number },
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (segmento !== "todas") params.set("segmento", segmento);
  if (pagina > 1) params.set("pagina", String(pagina));
  return params.size ? `${pathname}?${params}` : pathname;
}

interface ClientsViewProps {
  items: ClientSummary[];
  total: number;
  stats: ClientStats;
  query: string;
  segment: ClientSegment;
  page: number;
  pageSize: number;
  today: string;
  canManage: boolean;
  canDelete: boolean;
  initiallyOpen: boolean;
}

export function ClientsView({
  items,
  total,
  stats,
  query,
  segment,
  page,
  pageSize,
  today,
  canManage,
  canDelete,
  initiallyOpen,
}: ClientsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();
  const [search, setSearch] = useState(query);
  const [editing, setEditing] = useState<ClientSummary | "new" | null>(
    initiallyOpen ? "new" : null,
  );
  const [feedback, setFeedback] = useState("");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function updateUrl(next: { q?: string; segmento?: ClientSegment; pagina?: number }) {
    const url = buildUrl(pathname, {
      q: next.q ?? query,
      segmento: next.segmento ?? segment,
      pagina: next.pagina ?? 1,
    });
    startNavigation(() => router.replace(url, { scroll: false }));
  }

  // A busca vai ao servidor depois de uma pausa na digitação.
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === query) return;
    const timer = window.setTimeout(() => {
      const url = buildUrl(pathname, { q: trimmed, segmento: segment, pagina: 1 });
      startNavigation(() => router.replace(url, { scroll: false }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, query, router, search, segment]);

  function closeForm() {
    setEditing(null);
    if (initiallyOpen) updateUrl({ pagina: page });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        description="Centralize dados de contato, histórico e próximos compromissos."
        actions={
          canManage ? (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden="true" />
              Nova cliente
            </Button>
          ) : null
        }
      />

      {feedback ? (
        <Alert tone="success" onDismiss={() => setFeedback("")}>
          {feedback}
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo de clientes">
        {[
          { label: "Clientes cadastradas", value: stats.total, detail: "Base ativa", icon: UsersRound },
          { label: "Com horário marcado", value: stats.withUpcoming, detail: "Próximos dias", icon: CalendarCheck2 },
          { label: "Novas clientes", value: stats.withoutVisits, detail: "Sem atendimento concluído", icon: UserRoundPlus },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="surface-card flex items-center gap-4 p-4 sm:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xl font-extrabold text-ink-950 dark:text-ink-50">{item.value}</p>
                <p className="text-xs font-semibold text-ink-700 dark:text-ink-200">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-ink-600 dark:text-ink-300">{item.detail}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="surface-card overflow-hidden" aria-label="Lista de clientes">
        <div className="flex flex-col gap-3 border-b border-ink-100 dark:border-ink-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <SearchInput
            className="w-full sm:max-w-sm"
            placeholder="Buscar por nome, telefone, e-mail ou etiqueta..."
            aria-label="Buscar clientes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
          />
          <div className="flex overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-950 p-1" role="group" aria-label="Filtrar clientes">
            {(
              [
                ["todas", "Todas"],
                ["com-agenda", "Com agenda"],
                ["sem-agenda", "Sem agenda"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => updateUrl({ segmento: value })}
                aria-pressed={segment === value}
                className={cn(
                  "h-11 sm:h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
                  segment === value ? "bg-white dark:bg-ink-900 text-brand-700 dark:text-brand-300 shadow-sm" : "text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-100",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("transition-opacity", isNavigating && "opacity-60")} aria-busy={isNavigating}>
          {items.length ? (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {items.map((client) => (
                <li key={client.id}>
                  <ClientRow
                    client={client}
                    today={today}
                    onOpen={canManage ? () => setEditing(client) : undefined}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma cliente encontrada" description="Revise os termos da busca ou selecione outro filtro." />
          )}
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t min-[400px]:flex-row min-[400px]:items-center border-ink-100 dark:border-ink-800 bg-ink-50/50 dark:bg-ink-950/50 px-4 py-3 text-xs text-ink-500 dark:text-ink-400 sm:px-5">
          <span>
            {total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}` : "0"} clientes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateUrl({ pagina: page - 1 })}
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span>
              Página {page} de {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateUrl({ pagina: page + 1 })}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      <Modal
        open={editing !== null}
        onClose={closeForm}
        title={editing === "new" ? "Nova cliente" : "Editar cliente"}
        description={editing === "new" ? "Preencha os dados para cadastrar a cliente." : undefined}
      >
        {editing ? (
          <ClientForm
            key={editing === "new" ? "new" : editing.id}
            client={editing === "new" ? undefined : editing}
            today={today}
            canDelete={canDelete}
            onCancel={closeForm}
            onDone={(message) => {
              closeForm();
              setFeedback(message);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function ClientRow({
  client,
  today,
  onOpen,
}: {
  client: ClientSummary;
  today: string;
  onOpen?: () => void;
}) {
  const next = client.nextAppointment;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={client.name} color={colorFor(client.id)} decorative />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-ink-900 dark:text-ink-50">{client.name}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-600 dark:text-ink-300">
            {client.phone}
            {client.email ? ` · ${client.email}` : ""}
          </span>
          {client.tags.length ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {client.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-500 dark:text-ink-400">
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </span>
      <span className="grid min-w-0 grid-cols-2 gap-3 text-xs sm:shrink-0 sm:grid-cols-3 sm:gap-4 text-ink-600 dark:text-ink-300 md:w-md">
        <span>
          <span className="block text-[10px] uppercase tracking-wide text-ink-500 dark:text-ink-400">Última visita</span>
          {client.lastVisit
            ? formatDate(client.lastVisit, { day: "2-digit", month: "2-digit", year: "numeric" })
            : "Primeira visita"}
        </span>
        <span>
          <span className="block text-[10px] uppercase tracking-wide text-ink-500 dark:text-ink-400">Próximo horário</span>
          {next ? (
            <span className="font-semibold text-brand-700 dark:text-brand-300">
              {next.date === today ? "Hoje" : formatDate(next.date, { day: "2-digit", month: "short" })} às {next.startTime}
            </span>
          ) : (
            "Não agendado"
          )}
        </span>
        <span>
          <span className="block text-[10px] uppercase tracking-wide text-ink-500 dark:text-ink-400">Concluídos</span>
          <strong className="text-sm text-ink-800 dark:text-ink-100">{client.completedAppointments}</strong>
        </span>
      </span>
    </>
  );

  const className =
    "flex w-full flex-col gap-3 px-4 py-4 text-left md:flex-row md:items-center md:justify-between sm:px-5";

  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={cn(className, "transition hover:bg-ink-50/70 dark:hover:bg-ink-950/70 focus-visible:bg-ink-50 dark:focus-visible:bg-ink-950 focus-visible:outline-none")}
      aria-label={`Editar ${client.name}`}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
