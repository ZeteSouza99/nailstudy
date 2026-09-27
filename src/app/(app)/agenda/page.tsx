import type { Metadata } from "next";

import { AgendaView } from "@/components/agenda/agenda-view";
import { getTodayKey, getWeekDays } from "@/lib/date";
import { getWorkDayLabel } from "@/lib/scheduling";
import {
  listAppointmentsInRange,
  listBlocksInRange,
  listProfessionals,
  listServices,
} from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Agenda",
};

interface AgendaPageProps {
  searchParams: Promise<{ data?: string; visao?: string; novo?: string }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  await requirePageUser();
  const params = await searchParams;
  const today = getTodayKey();
  const selectedDate =
    typeof params.data === "string" && getWorkDayLabel(params.data) ? params.data : today;
  const view = params.visao === "dia" ? "day" : "week";
  const dates = view === "week" ? getWeekDays(selectedDate) : [selectedDate];
  const firstDay = dates[0];
  const lastDay = dates[dates.length - 1];

  const [appointments, professionals, services, blocks] = await Promise.all([
    listAppointmentsInRange(firstDay, lastDay),
    listProfessionals(),
    listServices(),
    listBlocksInRange(firstDay, lastDay),
  ]);

  return (
    <AgendaView
      appointments={appointments}
      professionals={professionals}
      services={services}
      blocks={blocks}
      today={today}
      selectedDate={selectedDate}
      view={view}
      initiallyOpen={params.novo === "1"}
    />
  );
}
