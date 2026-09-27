import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-base font-bold text-slate-950 dark:text-slate-50">
              Nail Agenda
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Agendamento online</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">Seg a Sáb · 08h às 19h</p>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-slate-400">
        Precisa de ajuda? Fale com o estúdio.
      </footer>
    </div>
  );
}
