import type { ReactNode } from "react";

import type { UserRole } from "@/types/domain";

import { DesktopSidebar } from "./desktop-sidebar";
import { MobileNavigation } from "./mobile-navigation";
import type { NavigationCounters } from "./navigation";
import { Topbar } from "./topbar";

export function AppShell({
  children,
  user,
  role,
  today,
  counters,
}: {
  children: ReactNode;
  user: { name: string; role: string };
  role: UserRole;
  today: string;
  counters: NavigationCounters;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-100 -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition focus-visible:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 dark:focus-visible:ring-teal-700"
      >
        Pular para o conteúdo
      </a>
      <DesktopSidebar role={role} counters={counters} />
      <div className="min-h-screen lg:pl-66">
        <Topbar user={user} today={today} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6"
        >
          {children}
        </main>
      </div>
      <MobileNavigation role={role} counters={counters} />
    </div>
  );
}
