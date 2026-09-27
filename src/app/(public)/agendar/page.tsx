import type { Metadata } from "next";

import { BookingWizard } from "@/components/booking/booking-wizard";
import { getBookingCatalog } from "@/server/portal-queries";

export const metadata: Metadata = {
  title: "Agendar horário",
  description: "Escolha o serviço, a profissional e o melhor horário para você.",
};

export const dynamic = "force-dynamic";

export default async function AgendarPage() {
  const catalog = await getBookingCatalog();

  if (catalog.services.length === 0 || catalog.professionals.length === 0) {
    return (
      <div className="surface-card p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Agendamento indisponível</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          No momento não há serviços abertos para agendamento online. Entre em contato com a
          equipe do estúdio.
        </p>
      </div>
    );
  }

  return <BookingWizard catalog={catalog} />;
}
