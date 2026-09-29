import type { Metadata } from "next";
import Link from "next/link";

import { RecoveryFlow } from "@/components/booking/recovery-flow";
import { isRecoveryAvailable } from "@/server/portal-queries";

export const metadata: Metadata = {
  title: "Encontrar meu agendamento",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function RecoveryPage() {
  if (!isRecoveryAvailable()) {
    return (
      <div className="surface-card p-6 text-center">
        <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-50">Perdeu o link do agendamento?</h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          Fale com o estúdio para remarcar ou cancelar. Você também pode{" "}
          <Link href="/agendar" className="font-semibold text-brand-700 dark:text-brand-300">
            fazer um novo agendamento
          </Link>
          .
        </p>
      </div>
    );
  }

  return <RecoveryFlow />;
}
