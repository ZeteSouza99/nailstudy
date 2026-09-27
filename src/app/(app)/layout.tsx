import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getTodayKey } from "@/lib/date";
import { getNavigationCounters } from "@/server/queries";
import { requirePageUser } from "@/server/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await requirePageUser();
  const today = getTodayKey();
  const counters = await getNavigationCounters(today);

  return (
    <AppShell
      today={today}
      counters={counters}
      user={{ name: user.name }}
    >
      {children}
    </AppShell>
  );
}
