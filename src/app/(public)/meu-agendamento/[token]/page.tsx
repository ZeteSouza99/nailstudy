import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppointmentManager } from "@/components/booking/appointment-manager";
import { getMaxBookingDate } from "@/lib/booking";
import { getTodayKey } from "@/lib/date";
import { getAppointmentByToken } from "@/server/portal-queries";

export const metadata: Metadata = {
  title: "Meu agendamento",
  robots: { index: false, follow: false },
  // O token está na URL: não pode vazar para outros sites pelo Referer.
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

export default async function MeuAgendamentoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const appointment = await getAppointmentByToken(token);

  if (!appointment) {
    notFound();
  }

  const today = getTodayKey();

  return (
    <AppointmentManager
      appointment={appointment}
      catalog={{ today, maxDate: getMaxBookingDate(today) }}
    />
  );
}
