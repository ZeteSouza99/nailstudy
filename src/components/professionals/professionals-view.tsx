"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { STUDIO_PROFESSIONAL_NAME } from "@/lib/studio";
import type { Professional } from "@/types/domain";
import { ProfessionalForm } from "./professional-form";

export function ProfessionalsView({ professional }: { professional: Professional }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Configurações" title="Meu estúdio" description="Configure os dias, horários de atendimento e intervalo de Erika Queiroz." />
      {saved ? <Alert tone="success" onDismiss={() => setSaved(false)}>Horários do estúdio atualizados.</Alert> : null}
      <section className="surface-card max-w-2xl" aria-label="Horários do estúdio">
        <div className="border-b border-ink-100 p-5 dark:border-ink-800 sm:p-6">
          <h2 className="text-lg font-bold">{STUDIO_PROFESSIONAL_NAME}</h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Nail Designer · Todos os atendimentos são realizados por Erika.</p>
        </div>
        <ProfessionalForm professional={professional} onDone={() => setSaved(true)} />
      </section>
    </div>
  );
}
