import type { Metadata } from "next";

import { ProfessionalsView } from "@/components/professionals/professionals-view";
import { addDays, getCurrentTime, getTodayKey, getWeekDays } from "@/lib/date";
import {
  listAppointmentsInRange,
  listBlocksInRange,
  listProfessionals,
  listServices,
} from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Profissionais",
};

export default async function ProfessionalsPage() {
  await requirePageUser();
  const today = getTodayKey();
  const weekDates = getWeekDays(today);
  const firstDay = weekDates[0];
  const lastDay = weekDates[weekDates.length - 1];

  const [professionals, services, appointments, blocks] = await Promise.all([
    listProfessionals(),
    listServices(),
    // Um mês à frente basta para mostrar o próximo horário de cada profissional.
    listAppointmentsInRange(firstDay, addDays(today, 30)),
    listBlocksInRange(firstDay, lastDay),
  ]);

  return (
    <ProfessionalsView
      professionals={professionals}
      services={services}
      appointments={appointments}
      blocks={blocks}
      weekDates={weekDates}
      today={today}
      currentTime={getCurrentTime()}
      canManage
    />
  );
}
