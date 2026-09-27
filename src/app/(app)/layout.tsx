import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getTodayKey } from "@/lib/date";
import { roleLabels } from "@/lib/permissions";
import { getNavigationCounters } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await requirePageUser();
  const today = getTodayKey();
  const counters = await getNavigationCounters(user, today);

  return (
    <AppShell
      today={today}
      role={user.role}
      counters={counters}
      user={{ name: user.name, role: roleLabels[user.role] }}
    >
      {children}
    </AppShell>
  );
}
