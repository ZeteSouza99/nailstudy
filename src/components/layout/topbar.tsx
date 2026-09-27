"use client";

import { Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { parseDateKey } from "@/lib/date";

import { routeMetadata } from "./navigation";
import { ThemeToggle } from "./theme-toggle";

const topbarDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function Topbar({
  user,
  today,
}: {
  user: { name: string };
  today: string;
}) {
  const pathname = usePathname();
  const metadata = routeMetadata[pathname] ?? routeMetadata["/"];
  const referenceDate = topbarDateFormatter.format(parseDateKey(today));
  const [weekday, datePart] = referenceDate.split(", ");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:h-18 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm lg:hidden">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:block">
              {metadata.section}
            </p>
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50 sm:text-base">
              {metadata.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <p className="hidden text-right text-xs leading-4 text-slate-500 dark:text-slate-400 md:block">
            <span className="block font-semibold capitalize text-slate-700 dark:text-slate-200">{weekday}</span>
            {datePart}
          </p>
          <ThemeToggle />
          <span className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 md:block" />
          <div
            className="flex items-center gap-2 rounded-xl p-1 text-left sm:pr-2"
            aria-label={`Sessão de ${user.name}`}
          >
            <Avatar name={user.name} color="#0f766e" size="sm" decorative />
            <span className="hidden sm:block">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{user.name}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">Administrador</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
