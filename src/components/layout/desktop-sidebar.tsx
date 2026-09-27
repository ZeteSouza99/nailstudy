"use client";

import { Globe, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/formatters";
import type { UserRole } from "@/types/domain";

import { Brand } from "./brand";
import { getNavigationSections, type NavigationCounters } from "./navigation";

export function DesktopSidebar({
  role,
  counters,
}: {
  role: UserRole;
  counters: NavigationCounters;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-66 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 lg:flex">
      <div className="px-5 pb-6 pt-6">
        <Brand />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Navegação principal">
        {getNavigationSections(role).map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400">{section.label}</p>

            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              // Contadores sinalizam trabalho pendente, não servem de enfeite.
              const count = item.badge ? counters[item.badge] : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                    active
                      ? "bg-teal-50 dark:bg-teal-950 font-semibold text-teal-900 dark:text-teal-200"
                      : "font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 hover:text-slate-900 dark:hover:text-slate-50",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0",
                      active ? "text-teal-700 dark:text-teal-300" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300",
                    )}
                    strokeWidth={active ? 2.2 : 2}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>

                  {count > 0 ? (
                    <span
                      className={cn(
                        "ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                        item.badge === "portalPending"
                          ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                          : active
                            ? "bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
                      )}
                    >
                      <span className="sr-only">Quantidade: </span>
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-100 dark:border-slate-800 p-3">
        <a
          href="/agendar"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-950 hover:text-slate-900 dark:hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Globe className="size-4.5 text-slate-400" aria-hidden="true" />
          Portal da cliente
        </a>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-950 hover:text-slate-900 dark:hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <LogOut className="size-4.5 text-slate-400" aria-hidden="true" />
          Sair
        </button>
      </div>
    </aside>
  );
}
