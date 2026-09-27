import type { Metadata } from "next";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getTodayKey } from "@/lib/date";
import { can } from "@/lib/permissions";
import { getDashboardData } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export const metadata: Metadata = {
  title: "Visão geral",
};

export default async function DashboardPage() {
  const user = await requirePageUser();
  const today = getTodayKey();
  const data = await getDashboardData(user, today);

  return (
    <DashboardView
      {...data}
      today={today}
      canCreateAppointment={can(user.role, "appointments:create")}
      canCreateClient={can(user.role, "clients:manage")}
    />
  );
}
