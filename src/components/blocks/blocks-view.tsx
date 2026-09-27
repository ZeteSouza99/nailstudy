"use client";

import { Ban, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { deleteBlockAction } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/formatters";
import type { Professional, ScheduleBlock } from "@/types/domain";

import { BlockForm } from "./block-form";

const dateFormat = { weekday: "short", day: "2-digit", month: "short" } as const;

interface BlocksViewProps {
  blocks: ScheduleBlock[];
  professionals: Professional[];
  today: string;
  canManage: boolean;
}

export function BlocksView({ blocks, professionals, today, canManage }: BlocksViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [removing, setRemoving] = useState<ScheduleBlock | null>(null);
  const [feedback, setFeedback] = useState("");
  const nameByProfessional = new Map(
    professionals.map((professional) => [professional.id, professional.name]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipe"
        title="Bloqueios de agenda"
        description="Feriados, folgas, férias e compromissos que impedem agendamentos no período."
        actions={
          canManage ? (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Novo bloqueio
            </Button>
          ) : null
        }
      />

      {feedback ? (
        <Alert tone="success" onDismiss={() => setFeedback("")}>
          {feedback}
        </Alert>
      ) : null}

      <section className="surface-card overflow-hidden" aria-label="Bloqueios atuais e futuros">
        {blocks.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    <Ban className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{block.reason}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {block.professionalId
                        ? (nameByProfessional.get(block.professionalId) ?? "Profissional removida")
                        : "Estúdio inteiro"}
                      {" · "}
                      {block.startDate === block.endDate
                        ? formatDate(block.startDate, dateFormat)
                        : `${formatDate(block.startDate, dateFormat)} a ${formatDate(block.endDate, dateFormat)}`}
                      {" · "}
                      {block.startTime && block.endTime ? `${block.startTime}–${block.endTime}` : "dia inteiro"}
                    </p>
                  </div>
                </div>
                {canManage ? (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(block)} aria-label={`Remover bloqueio ${block.reason}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhum bloqueio programado" description="A agenda segue o horário normal de cada profissional." />
        )}
      </section>

      {canManage ? (
        <>
          <Modal
            open={isCreating}
            onClose={() => setIsCreating(false)}
            title="Novo bloqueio"
            description="Escolha o período e quem fica indisponível."
          >
            {isCreating ? (
              <BlockForm
                professionals={professionals}
                today={today}
                onCancel={() => setIsCreating(false)}
                onDone={(message) => {
                  setIsCreating(false);
                  setFeedback(message);
                }}
              />
            ) : null}
          </Modal>

          <ConfirmDialog
            open={removing !== null}
            title="Remover bloqueio?"
            description="O período volta a aceitar agendamentos."
            confirmLabel="Remover"
            onConfirm={() => deleteBlockAction(removing?.id)}
            onClose={() => setRemoving(null)}
            onConfirmed={() => {
              setRemoving(null);
              setFeedback("Bloqueio removido.");
            }}
          />
        </>
      ) : null}
    </div>
  );
}
