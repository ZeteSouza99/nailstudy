import type { Metadata } from "next";

import { PendingList } from "@/components/agenda/pending-list";
import { getTodayKey } from "@/lib/date";
import { listPendingPortalAppointments } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Pendentes do portal",
};

export default async function PendingPage() {
  await requirePageUser();
  const appointments = await listPendingPortalAppointments(getTodayKey());

  return <PendingList appointments={appointments} />;
}
