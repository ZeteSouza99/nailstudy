import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Brand } from "@/components/layout/brand";

export default function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-ink-50 dark:bg-ink-950">
      <header className="pt-[env(safe-area-inset-top)] border-b border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Brand />
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-ink-500 dark:text-ink-400 sm:block">Seg a Sáb · 08h às 19h</p>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-xs text-ink-400">
        Erika Queiroz · Nail Designer. Precisa de ajuda? Fale com o estúdio.
      </footer>
    </div>
  );
}
